// errorHandler.js
// Global error handling middleware for Express

const { ERROR_CODES } = require('../utils/constants');
const logger = require('../utils/logger');

function errorHandler(err, req, res, next) {
    // Log error details
    logger.error('Request error', {
        error: err.message,
        stack: err.stack,
        path: req.path,
        method: req.method,
        body: req.body
    });

    // Determine error type and response
    let statusCode = 500;
    let errorCode = ERROR_CODES.INTERNAL_ERROR;
    let message = 'Internal server error';

    if (err.message) {
        message = err.message;
    }

    // Handle specific error types
    if (err.message?.includes('not found') || err.message?.includes('Not found')) {
        statusCode = 404;
        errorCode = ERROR_CODES.JOB_NOT_FOUND;
    } else if (err.message?.includes('unauthorized') || err.message?.includes('Unauthorized')) {
        statusCode = 401;
        errorCode = ERROR_CODES.UNAUTHORIZED;
    } else if (err.message?.includes('token') && err.message?.includes('not found')) {
        statusCode = 404;
        errorCode = ERROR_CODES.TOKEN_NOT_FOUND;
    } else if (err.message?.includes('Rate limited')) {
        statusCode = 429;
        errorCode = ERROR_CODES.RATE_LIMITED;
    } else if (err.message?.includes('required') || err.message?.includes('invalid')) {
        statusCode = 400;
        errorCode = ERROR_CODES.INVALID_REQUEST;
    }

    // Send error response
    res.status(statusCode).json({
        error: {
            code: errorCode,
            message: message
        }
    });
}

module.exports = errorHandler;
