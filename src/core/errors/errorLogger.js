'use strict';

function logError(error, req) {
	const requestId = req?.id || 'unknown';
	const isDev = process.env.NODE_ENV === 'development';

	if (isDev) {
		console.error(`[ERROR] Request ID: ${requestId}`);
		console.error(error);
		return;
	}

	if (error.statusCode >= 500) {
		console.error(`[ERROR] Request ID: ${requestId} - ${error.message}`);
	}
}

module.exports = logError;
