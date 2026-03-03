'use strict';

/**
 * requireRole — blocks if the user's role name is not in the allowed list.
 * Usage: router.get('/x', authMiddleware, requireRole('admin'), handler)
 */
const requireRole = (...allowedRoles) => (req, res, next) => {
  const roles = req.user.roles || [req.user.role];
  const systemRole = req.user.systemRole || null;
  if (roles.includes('admin') || systemRole === 'admin') return next(); // admin implicit superuser
  if (allowedRoles.some((r) => roles.includes(r))) return next();
  if (systemRole && allowedRoles.includes(systemRole)) return next();
  return res.status(403).json({ success: false, message: 'Insufficient role' });

};

/**
 * requirePermission — checks the permissions[] array from the JWT.
 * Zero DB queries — permissions travel with the token.
 * Usage: router.post('/roles', authMiddleware, requirePermission('access_to_roles_permission'), handler)
 */
const requirePermission = (permission) => (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({ success: false, message: 'Authentication required' });
  }
  // Admin bypasses all permission checks (check full roles array)
  const roles = req.user.roles || [req.user.role];
    const systemRole = req.user.systemRole || null;
  if (roles.includes('admin') || systemRole === 'admin') return next();

  const permissions = req.user.permissions || []; // flat array of key strings from JWT
  if (!permissions.includes(permission)) {
    return res.status(403).json({
      success: false,
      message: `Access denied. Required permission: ${permission}`,
      required: permission,
      yourRole: req.user.role,
    });
  }
  return next();
};

/**
 * requireAnyPermission — passes if the user has AT LEAST ONE of the listed permissions.
 * Use for read/list routes where the sidebar shows the module for either view OR edit holders.
 *
 * Usage:
 *   router.get('/', authMiddleware, requireAnyPermission('role_view', 'role_edit'), getRoles);
 */
const requireAnyPermission = (...permissions) => (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({ success: false, message: 'Authentication required' });
  }
  // Admin bypasses all permission checks
  const roles = req.user.roles || [req.user.role];
  const systemRole = req.user.systemRole || null;
  if (roles.includes('admin') || systemRole === 'admin') return next();

  const userPerms = req.user.permissions || [];
  if (permissions.some((p) => userPerms.includes(p))) return next();

  return res.status(403).json({
    success: false,
    message: `Access denied. Required one of: ${permissions.join(', ')}`,
    required: permissions,
  });
};

module.exports = { requireRole, requirePermission, requireAnyPermission };
