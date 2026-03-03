'use strict';

const jwt = require('jsonwebtoken');

const authMiddleware = (req, res, next) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ success: false, message: 'No token provided' });
  }

  const token = authHeader.split(' ')[1];

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = {
      id:          decoded.id,
      email:       decoded.email,
      role:        decoded.role,                                        // primary role string (backward-compat)
      roles:       decoded.roles || [decoded.role].filter(Boolean),    // full roles array
      permissions: decoded.permissions || [],   
      systemRole: decoded.systemRole || null,                        // flat permission keys array
    };
    next();
  } catch (err) {
    return res.status(401).json({ success: false, message: 'Token invalid or expired' });
  }
};

module.exports = { authMiddleware };
