'use strict';

const ERROR_CODES = require('./errorCodes');
const {
	AppError,
	ValidationError,
	UnauthorizedError,
	ForbiddenError,
	NotFoundError,
	ConflictError,
} = require('./AppError');

const STATUS_CODE_TO_ERROR = {
	400: ERROR_CODES.VALIDATION_ERROR,
	401: ERROR_CODES.UNAUTHORIZED,
	403: ERROR_CODES.FORBIDDEN,
	404: ERROR_CODES.NOT_FOUND,
	409: ERROR_CODES.CONFLICT_ERROR,
};

function attachOriginal(normalized, original) {
	if (original && !normalized.originalError) {
		normalized.originalError = original;
	}
	return normalized;
}

function normalizeError(error) {
	if (!error) {
		return new AppError('Internal Server Error', 500, ERROR_CODES.INTERNAL_ERROR, { isOperational: false });
	}

	if (error instanceof AppError) {
		return attachOriginal(error, error.originalError || error);
	}

	if (error.isOperational && typeof error.statusCode === 'number') {
		return attachOriginal(
			new AppError(
				error.message || 'Operation failed',
				error.statusCode,
				error.errorCode || STATUS_CODE_TO_ERROR[error.statusCode] || ERROR_CODES.INTERNAL_ERROR,
				{ isOperational: true }
			),
			error
		);
	}

	if (error.isJoi) {
		const messages = error.details ? error.details.map((d) => d.message).join(', ') : error.message;
		return attachOriginal(new ValidationError(messages), error);
	}

	if (error.name === 'SequelizeValidationError') {
		const messages = error.errors ? error.errors.map((e) => e.message).join(', ') : 'Validation error';
		return attachOriginal(new ValidationError(messages), error);
	}

	if (error.name === 'SequelizeForeignKeyConstraintError') {
		return attachOriginal(
			new AppError('Referenced resource does not exist', 400, ERROR_CODES.FOREIGN_KEY_ERROR),
			error
		);
	}

	if (error.name === 'SequelizeUniqueConstraintError') {
		const field = error.errors?.[0]?.path || 'field';
		return attachOriginal(
			new AppError(`The ${field} already exists`, 409, ERROR_CODES.DUPLICATE_ERROR),
			error
		);
	}

	if (typeof error.statusCode === 'number') {
		return attachOriginal(
			new AppError(
				error.message || 'Operation failed',
				error.statusCode,
				error.errorCode || STATUS_CODE_TO_ERROR[error.statusCode] || ERROR_CODES.INTERNAL_ERROR,
				{ isOperational: true }
			),
			error
		);
	}

	if (typeof error === 'string') {
		return attachOriginal(
			new AppError(error, 500, ERROR_CODES.INTERNAL_ERROR, { isOperational: false }),
			error
		);
	}

	if (typeof error.message === 'string' && error.message.toLowerCase().includes('rollback')) {
		return attachOriginal(
			new AppError('Operation failed. Please try again.', 500, ERROR_CODES.TRANSACTION_ERROR, { isOperational: false }),
			error
		);
	}

	return attachOriginal(
		new AppError(error.message || 'Internal Server Error', 500, ERROR_CODES.INTERNAL_ERROR, { isOperational: false }),
		error
	);
}

module.exports = normalizeError;
