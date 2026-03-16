'use strict';

const jwt = require('jsonwebtoken');

const authMiddleware = (req, res, next) => {
  // Primary: httpOnly cookie (fully XSS-safe, JS never touches it)
  // Fallback: Authorization header (for direct API calls / Postman / scripts)
  const token =
    req.cookies?.lms_access ||
    req.headers.authorization?.split(' ')[1];

  if (!token) {
    return res.status(401).json({ success: false, message: 'No token provided' });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = {
      id: decoded.id,
      email: decoded.email,
      role: decoded.role,
      roles: decoded.roles || [decoded.role].filter(Boolean),
      permissions: decoded.permissions || [],
      systemRole: decoded.systemRole || null,
    };
    next();
  } catch (err) {
    return res.status(401).json({ success: false, message: 'Token invalid or expired' });
  }
};

module.exports = { authMiddleware };