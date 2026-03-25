'use strict';

const { Op } = require('sequelize');
const jwt = require('jsonwebtoken');
const RefreshToken = require('../../models/RefreshToken');
 
const authMiddleware = async (req, res, next) => {
  const headerToken = req.headers.authorization?.startsWith('Bearer ')
    ? req.headers.authorization.split(' ')[1]
    : null;
  const cookieToken = req.cookies?.lms_access || null;
  const token = headerToken || cookieToken;
 
  if (!token) {
    return res.status(401).json({ success: false, message: 'No token provided' });
  }
 
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    if (!decoded.sid) {
      return res.status(401).json({ success: false, message: 'Session identifier missing. Please login again.' });
    }

    const activeSession = await RefreshToken.findOne({
      where: {
        id: decoded.sid,
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
      roles: Array.isArray(decoded.roles) && decoded.roles.length > 0
        ? decoded.roles
        : [decoded.role].filter(Boolean),
      permissions: decoded.permissions || [],
      systemRole: decoded.systemRole || null,
      sessionId: decoded.sid,
    };
    next();
  } catch (err) {
    return res.status(401).json({ success: false, message: 'Token invalid or expired' });
  }
};
 
module.exports = { authMiddleware };
 