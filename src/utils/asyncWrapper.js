'use strict';

/**
 * Custom Error Classes for better error handling
 */
class AppError extends Error {
  constructor(message, statusCode = 500, errorCode = 'INTERNAL_ERROR') {
    super(message);
    this.statusCode = statusCode;
    this.errorCode = errorCode;
    this.isOperational = true;
    Error.captureStackTrace(this, this.constructor);
  }
}

class ValidationError extends AppError {
  constructor(message) {
    super(message, 400, 'VALIDATION_ERROR');
  }
}

class NotFoundError extends AppError {
  constructor(resource = 'Resource') {
    super(`${resource} not found`, 404, 'NOT_FOUND');
  }
}

class UnauthorizedError extends AppError {
  constructor(message = 'Unauthorized') {
    super(message, 401, 'UNAUTHORIZED');
  }
}

class ForbiddenError extends AppError {
  constructor(message = 'Forbidden') {
    super(message, 403, 'FORBIDDEN');
  }
}

class ConflictError extends AppError {
  constructor(message) {
    super(message, 409, 'CONFLICT_ERROR');
  }
}

/**
 * Wraps async Express route handlers to eliminate try/catch boilerplate.
 * @param {Function} fn - Async controller function
 * @returns {Function} Express middleware
 */
const asyncWrapper = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};

/**
 * Global error handler middleware.
 */
const globalErrorHandler = (err, req, res, next) => {
  const requestId = req.id || 'unknown';
  const isDev = process.env.NODE_ENV === 'development';

  if (isDev) {
    console.error(`[ERROR] Request ID: ${requestId}`);
    console.error(err);
  } else {
    if (err.statusCode >= 500) {
      console.error(`[ERROR] Request ID: ${requestId} - ${err.message}`);
    }
  }

  if (err.isJoi) {
    const messages = err.details ? err.details.map(d => d.message).join(', ') : err.message;
    return res.status(400).json({
      success: false,
      errorCode: 'VALIDATION_ERROR',
      message: messages,
      requestId,
    });
  }

  if (err.isOperational) {
    return res.status(err.statusCode).json({
      success: false,
      errorCode: err.errorCode,
      message: err.message,
      requestId,
    });
  }

  if (err.name === 'SequelizeValidationError') {
    const messages = err.errors ? err.errors.map(e => e.message).join(', ') : 'Validation error';
    return res.status(400).json({
      success: false,
      errorCode: 'VALIDATION_ERROR',
      message: messages,
      requestId,
    });
  }

  if (err.name === 'SequelizeForeignKeyConstraintError') {
    return res.status(400).json({
      success: false,
      errorCode: 'FOREIGN_KEY_ERROR',
      message: 'Referenced resource does not exist',
      requestId,
    });
  }

  if (err.name === 'SequelizeUniqueConstraintError') {
    const field = err.errors?.[0]?.path || 'field';
    return res.status(409).json({
      success: false,
      errorCode: 'DUPLICATE_ERROR',
      message: `The ${field} already exists`,
      requestId,
    });
  }

  if (err.message && err.message.includes('rollback')) {
    return res.status(500).json({
      success: false,
      errorCode: 'TRANSACTION_ERROR',
      message: 'Operation failed. Please try again.',
      requestId,
    });
  }

  const message = isDev ? err.message : 'Internal Server Error';
  
  res.status(500).json({
    success: false,
    errorCode: 'INTERNAL_ERROR',
    message,
    ...(isDev && { stack: err.stack, requestId }),
    requestId,
  });
};

const notFoundHandler = (req, res) => {
  res.status(404).json({
    success: false,
    errorCode: 'NOT_FOUND',
    message: `Route ${req.method} ${req.originalUrl} not found`,
    requestId: req.id,
  });
};

const requestIdMiddleware = (req, res, next) => {
  const generateId = () => {
    return Date.now().toString(36) + Math.random().toString(36).substring(2, 15);
  };
  
  req.id = req.headers['x-request-id'] || generateId();
  res.setHeader('X-Request-ID', req.id);
  next();
};

// Main export - asyncWrapper as default
module.exports = asyncWrapper;

// Named exports
module.exports.asyncWrapper = asyncWrapper;
module.exports.globalErrorHandler = globalErrorHandler;
module.exports.notFoundHandler = notFoundHandler;
module.exports.requestIdMiddleware = requestIdMiddleware;

// Error classes
module.exports.AppError = AppError;
module.exports.ValidationError = ValidationError;
module.exports.NotFoundError = NotFoundError;
module.exports.UnauthorizedError = UnauthorizedError;
module.exports.ForbiddenError = ForbiddenError;
module.exports.ConflictError = ConflictError;

// Default export for backward compatibility
module.exports.default = asyncWrapper;

