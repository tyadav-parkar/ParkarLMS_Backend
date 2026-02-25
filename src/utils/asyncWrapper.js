'use strict';

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
 * Register last in Express with app.use(globalErrorHandler).
 */
const globalErrorHandler = (err, req, res, next) => {
  const isDev = process.env.NODE_ENV === 'development';

  if (isDev) {
    console.error('[ERROR]', err);
  }

  const statusCode = err.statusCode || 500;
  const response = {
    success: false,
    message: err.message || 'Internal Server Error',
    ...(isDev && { stack: err.stack }),
  };

  res.status(statusCode).json(response);
};

module.exports = asyncWrapper;
module.exports.globalErrorHandler = globalErrorHandler;
