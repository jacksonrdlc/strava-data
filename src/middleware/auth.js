// auth.js
// IAM authentication middleware for Cloud Run
// Note: Cloud Run handles token verification at the platform level
// This middleware provides additional validation if needed

const { ERROR_CODES } = require('../utils/constants');
const logger = require('../utils/logger');

/**
 * Verify Cloud Run IAM authentication
 * When deployed with --no-allow-unauthenticated, Cloud Run validates tokens
 * before requests reach the application
 */
function authenticateIAM(req, res, next) {
    const authHeader = req.headers.authorization;

    // Check for Authorization header
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        logger.warn('Missing or invalid authorization header', {
            path: req.path,
            method: req.method
        });

        return res.status(401).json({
            error: {
                code: ERROR_CODES.UNAUTHORIZED,
                message: 'Missing or invalid authorization header'
            }
        });
    }

    // For Cloud Run with IAM auth enabled, the request reaching here
    // means the token has already been validated by the platform
    // Additional custom validation can be added here if needed

    logger.debug('Request authenticated', {
        path: req.path,
        method: req.method
    });

    next();
}

/**
 * Optional: Skip authentication for specific routes
 */
function skipAuth(req, res, next) {
    next();
}

module.exports = {
    authenticateIAM,
    skipAuth
};
