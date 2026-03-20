'use strict';
 
const { Op } = require('sequelize');
const jwt = require('jsonwebtoken');
const RefreshToken = require('../../models/RefreshToken');
 
const authMiddleware = async (req, res, next) => {
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
 
    // Session guard: if all refresh sessions are revoked/deleted, reject access immediately.
    const activeSession = await RefreshToken.findOne({
      where: {
        employee_id: decoded.id,
        is_revoked: false,
        expires_at: { [Op.gt]: new Date() },
      },
      attributes: ['id'],
    });
 
    if (!activeSession) {
      return res.status(401).json({ success: false, message: 'Session revoked or expired. Please login again.' });
    }
 
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
 