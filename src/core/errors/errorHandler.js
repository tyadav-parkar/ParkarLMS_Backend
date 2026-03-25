'use strict';

const normalizeError = require('./normalizeError');
const logError = require('./errorLogger');
const ERROR_CODES = require('./errorCodes');

function errorHandler(err, req, res, _next) {
	const normalizedError = normalizeError(err);
	logError(normalizedError, req);

	const isDev = process.env.NODE_ENV === 'development';
	const shouldHideMessage = normalizedError.statusCode >= 500 && !isDev && !normalizedError.isOperational;
	const responseMessage = shouldHideMessage ? 'Internal Server Error' : normalizedError.message;
	const payload = {
		success: false,
		errorCode: normalizedError.errorCode || ERROR_CODES.INTERNAL_ERROR,
		message: responseMessage,
		requestId: req.id || 'unknown',
	};

	if (!normalizedError.isOperational && isDev) {
		payload.stack = normalizedError.stack;
	}

	res.status(normalizedError.statusCode || 500).json(payload);
}

module.exports = errorHandler;
