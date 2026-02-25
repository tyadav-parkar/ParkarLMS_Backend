'use strict';

/**
 * Role-based access control middleware factory.
 * Always call authMiddleware before this.
 *
 * Usage:
 *   router.patch('/employees/:id', authMiddleware, requireRole('admin'), controller)
 *   router.post('/assignments', authMiddleware, requireRole('admin', 'manager'), controller)
 */
const requireRole = (...allowedRoles) => (req, res, next) => {
  const { role } = req.user;

  // Admin bypasses all role checks
  if (role === 'admin') return next();

  if (allowedRoles.includes(role)) return next();

  return res.status(403).json({ success: false, message: 'Insufficient permissions' });
};

module.exports = { requireRole };
