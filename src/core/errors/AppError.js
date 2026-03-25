'use strict';

const ERROR_CODES = require('./errorCodes');

class AppError extends Error {
	constructor(message, statusCode = 500, errorCode = ERROR_CODES.INTERNAL_ERROR, options = {}) {
		super(message || 'Internal Server Error');
		this.statusCode = statusCode;
		this.errorCode = errorCode;
		this.isOperational = options.isOperational !== undefined ? options.isOperational : true;
		if (options.details) this.details = options.details;
		Error.captureStackTrace(this, this.constructor);
	}
}

class ValidationError extends AppError {
	constructor(message = 'Validation failed') {
		super(message, 400, ERROR_CODES.VALIDATION_ERROR);
	}
}

class NotFoundError extends AppError {
	constructor(resource = 'Resource') {
		super(`${resource} not found`, 404, ERROR_CODES.NOT_FOUND);
	}
}

class UnauthorizedError extends AppError {
	constructor(message = 'Unauthorized') {
		super(message, 401, ERROR_CODES.UNAUTHORIZED);
	}
}

class ForbiddenError extends AppError {
	constructor(message = 'Forbidden') {
		super(message, 403, ERROR_CODES.FORBIDDEN);
	}
}

class ConflictError extends AppError {
	constructor(message = 'Conflict') {
		super(message, 409, ERROR_CODES.CONFLICT_ERROR);
	}
}

module.exports = {
	ERROR_CODES,
	AppError,
	ValidationError,
	NotFoundError,
	UnauthorizedError,
	ForbiddenError,
	ConflictError,
};
