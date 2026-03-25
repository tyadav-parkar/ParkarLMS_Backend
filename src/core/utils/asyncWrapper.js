'use strict';

const errorHandler = require('../errors/errorHandler');
const {
	AppError,
	ValidationError,
	NotFoundError,
	UnauthorizedError,
	ForbiddenError,
	ConflictError,
} = require('../errors/AppError');

const asyncWrapper = (fn) => (req, res, next) => {
	Promise.resolve(fn(req, res, next)).catch(next);
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
	const generateId = () => Date.now().toString(36) + Math.random().toString(36).substring(2, 15);

	req.id = req.headers['x-request-id'] || generateId();
	res.setHeader('X-Request-ID', req.id);
	next();
};

module.exports = asyncWrapper;
module.exports.asyncWrapper = asyncWrapper;
module.exports.globalErrorHandler = errorHandler;
module.exports.notFoundHandler = notFoundHandler;
module.exports.requestIdMiddleware = requestIdMiddleware;
module.exports.AppError = AppError;
module.exports.ValidationError = ValidationError;
module.exports.NotFoundError = NotFoundError;
module.exports.UnauthorizedError = UnauthorizedError;
module.exports.ForbiddenError = ForbiddenError;
module.exports.ConflictError = ConflictError;
module.exports.default = asyncWrapper;
