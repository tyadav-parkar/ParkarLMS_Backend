'use strict';

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
 * requirePermission — checks the permissions[] array from the JWT.
 * Zero DB queries — permissions travel with the token.
 *
 * Admin bypass: always passes.
 * Everyone else: must have the exact permission key in their JWT permissions[].
 *
 * Usage: router.post('/roles', authMiddleware, requirePermission('role_edit'), handler)
 */
const requirePermission = (permission) => (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({ success: false, message: 'Authentication required' });
  }

  const roles      = (req.user.roles || [req.user.role]).map(r => r?.toLowerCase());
  const systemRole = req.user.systemRole?.toLowerCase() || null;

  // Admin bypasses all permission checks
  if (roles.includes('admin') || systemRole === 'admin') return next();

  // Check explicit permission — no system role bypass here.
  // Manager/employee must have the permission explicitly assigned via a role.
  const permissions = req.user.permissions || [];
  if (permissions.includes(permission)) return next();

  return res.status(403).json({
    success: false,
    message: `Access denied. Required permission: ${permission}`,
    required: permission,
    yourRole: req.user.role,
  });
};

/**
 * requireAnyPermission — passes if the user has AT LEAST ONE of the listed permissions.
 * Use for read/list routes where sidebar shows module for either view OR edit holders.
 *
 * Admin bypass: always passes.
 * Everyone else: must have at least one of the listed permission keys.
 *
 * Usage:
 *   router.get('/', authMiddleware, requireAnyPermission('role_view', 'role_edit'), getRoles);
 */
const requireAnyPermission = (...permissions) => (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({ success: false, message: 'Authentication required' });
  }

  const roles = (req.user.roles || [req.user.role]).map(r => r?.toLowerCase());
  const systemRole = req.user.systemRole?.toLowerCase() || null;

  // Admin bypasses all permission checks
  if (roles.includes('admin') || systemRole === 'admin') return next();

  // Check if user has at least one of the required permissions
  const userPerms = req.user.permissions || [];
  if (permissions.some(p => userPerms.includes(p))) return next();

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