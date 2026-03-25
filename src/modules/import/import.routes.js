'use strict';

/**
 * import.routes.js
 * modules/import/import.routes.js
 *
 * Mounted in routes/index.js:
 *   router.use('/import', require('../modules/import/import.routes'));
 *
 * Endpoints:
 *   POST /api/import/employees
 *   GET  /api/import/logs
 */

const express = require('express');
const multer  = require('multer');
const router  = express.Router();

const { authMiddleware }                   = require('../../core/middlewares/authMiddleware');
const { importEmployees, getImportLogs }   = require('./import.controller');
const { AppError }                         = require('../../core/errors/AppError');
const logger                               = require('../../core/utils/logger');

// ── Multer — memory storage, no disk writes ───────────────────────────────────
const MAX_FILE_SIZE_BYTES = (parseInt(process.env.IMPORT_MAX_FILE_SIZE_MB) || 5) * 1024 * 1024;

const upload = multer({
  storage: multer.memoryStorage(),
  limits:  { fileSize: MAX_FILE_SIZE_BYTES },
  fileFilter: (_req, file, cb) => {
    const allowed = new Set([
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/vnd.ms-excel',
    ]);
    if (allowed.has(file.mimetype)) return cb(null, true);
    cb(Object.assign(
      new Error('Only .xlsx and .xls files are accepted'),
      { statusCode: 415 }
    ));
  },
}).single('file'); // multipart field name must be "file"

// Wrap multer so errors return JSON, not Express default HTML
function uploadMiddleware(req, res, next) {
  upload(req, res, (err) => {
    if (!err) return next();
    const status  = err.code === 'LIMIT_FILE_SIZE' ? 413 : (err.statusCode || 400);
    const message = err.code === 'LIMIT_FILE_SIZE'
      ? `File exceeds the ${process.env.IMPORT_MAX_FILE_SIZE_MB || 5} MB limit`
      : err.message;

    logger.warn('Import upload rejected', {
      operation: 'EMPLOYEE_IMPORT',
      status,
      message,
      reason: err.code || 'UNKNOWN',
      userId: req.user?.id,
    });

    return next(new AppError(message, status));
  });
}

// ── Admin guard ───────────────────────────────────────────────────────────────
// Import is a destructive operation (upserts + soft deletes entire headcount).
// Strictly admin only — never delegatable via custom permissions.
function requireAdmin(req, res, next) {
  if (req.user?.systemRole === 'admin') return next();

  logger.warn('Import access denied for non-admin user', {
    operation: 'EMPLOYEE_IMPORT',
    userId: req.user?.id,
    systemRole: req.user?.systemRole,
  });

  return next(new AppError('Access denied. Admin role required.', 403));
}

// ── Routes ────────────────────────────────────────────────────────────────────
router.post('/employees', authMiddleware, requireAdmin, uploadMiddleware, importEmployees);
router.get('/logs',       authMiddleware, requireAdmin, getImportLogs);

module.exports = router;