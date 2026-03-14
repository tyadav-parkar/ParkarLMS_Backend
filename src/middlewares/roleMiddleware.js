'use strict';

const { Employee, Role, Permission } = require('../models');

/**
 * Fetch current permission keys for an employee directly from the DB.
 * Returns null if the employee doesn't exist or is inactive.
 * Called by requirePermission / requireAnyPermission so admin role-permission
 * changes take effect on the very next API request — no JWT expiry wait.
 */
async function getEmployeePermissions(employeeId) {
  const employee = await Employee.findByPk(employeeId, {
    include: [{
      model: Role,
      as:    'roles',
      through: { attributes: [] },
      include: [{
        model:      Permission,
        as:         'permissions',
        through:    { attributes: [] },
        attributes: ['key'],
      }],
    }],
  });

  if (!employee || !employee.is_active) return null;
  return employee.roles.flatMap(r => (r.permissions || []).map(p => p.key));
}

/**
 * requireRole — blocks if the user's role name is not in the allowed list.
 * Usage: router.get('/x', authMiddleware, requireRole('admin'), handler)
 */
const requireRole = (...allowedRoles) => (req, res, next) => {
  const roles      = (req.user.roles || [req.user.role]).map(r => r?.toLowerCase());
  const systemRole = req.user.systemRole?.toLowerCase() || null;

  // Admin is always allowed
  if (roles.includes('admin') || systemRole === 'admin') return next();

  // Check if user has any of the allowed roles (case-insensitive)
  const allowed = allowedRoles.map(r => r.toLowerCase());
  if (allowed.some(r => roles.includes(r))) return next();
  if (systemRole && allowed.includes(systemRole)) return next();

  return res.status(403).json({ success: false, message: 'Insufficient role' });
};

/**
 * requirePermission — live DB lookup so permission changes are enforced immediately.
 *
 * Admin bypass: reads system role from JWT (structural, never permission-based).
 * Everyone else: fetches fresh permission keys from DB on every request.
 *
 * Usage: router.post('/roles', authMiddleware, requirePermission('role_edit'), handler)
 */
const requirePermission = (permission) => async (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({ success: false, message: 'Authentication required' });
  }

  const roles      = (req.user.roles || [req.user.role]).map(r => r?.toLowerCase());
  const systemRole = req.user.systemRole?.toLowerCase() || null;

  // Admin bypass — system role is structural, safe to read from JWT
  if (roles.includes('admin') || systemRole === 'admin') return next();

  try {
    const freshPerms = await getEmployeePermissions(req.user.id);
    if (freshPerms === null) {
      return res.status(401).json({ success: false, message: 'Account not found or deactivated' });
    }
    if (freshPerms.includes(permission)) return next();
  } catch (err) {
    return next(err);
  }

  return res.status(403).json({
    success: false,
    message: `Access denied. Required permission: ${permission}`,
    required: permission,
    yourRole: req.user.role,
  });
};

/**
 * requireAnyPermission — live DB lookup so permission changes are enforced immediately.
 *
 * Admin bypass: reads system role from JWT (structural, never permission-based).
 * Everyone else: fetches fresh permission keys from DB, passes if has at least one.
 *
 * Usage:
 *   router.get('/', authMiddleware, requireAnyPermission('role_view', 'role_edit'), getRoles);
 */
const requireAnyPermission = (...permissions) => async (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({ success: false, message: 'Authentication required' });
  }

  const roles = (req.user.roles || [req.user.role]).map(r => r?.toLowerCase());
  const systemRole = req.user.systemRole?.toLowerCase() || null;

  // Admin bypass — system role is structural, safe to read from JWT
  if (roles.includes('admin') || systemRole === 'admin') return next();

  try {
    const freshPerms = await getEmployeePermissions(req.user.id);
    if (freshPerms === null) {
      return res.status(401).json({ success: false, message: 'Account not found or deactivated' });
    }
    if (permissions.some(p => freshPerms.includes(p))) return next();
  } catch (err) {
    return next(err);
  }

  return res.status(403).json({
    success: false,
    message: `Access denied. Required one of: ${permissions.join(', ')}`,
    required: permissions,
  });
};

module.exports = { 
  requireRole, 
  requirePermission, 
  requireAnyPermission 
};