// validation.js
// Request validation middleware

const { ERROR_CODES, SYNC_TYPES } = require('../utils/constants');

/**
 * Validate sync job creation request
 */
function validateSyncRequest(req, res, next) {
    const { user_id, sync_type, after, before } = req.body;

    const errors = [];

    // Validate user_id
    if (!user_id) {
        errors.push('user_id is required');
    } else if (typeof user_id !== 'string' && typeof user_id !== 'number') {
        errors.push('user_id must be a string or number');
    }

    // Validate sync_type (optional)
    if (sync_type && !Object.values(SYNC_TYPES).includes(sync_type)) {
        errors.push(`sync_type must be one of: ${Object.values(SYNC_TYPES).join(', ')}`);
    }

    // Validate dates (optional)
    if (after && isNaN(Date.parse(after))) {
        errors.push('after must be a valid ISO date string');
    }

    if (before && isNaN(Date.parse(before))) {
        errors.push('before must be a valid ISO date string');
    }

    if (errors.length > 0) {
        return res.status(400).json({
            error: {
                code: ERROR_CODES.INVALID_REQUEST,
                message: 'Validation failed',
                details: errors
            }
        });
    }

    next();
}

/**
 * Validate OAuth callback request
 */
function validateOAuthCallback(req, res, next) {
    const { code } = req.query;

    if (!code) {
        return res.status(400).json({
            error: {
                code: ERROR_CODES.INVALID_REQUEST,
                message: 'Authorization code is required'
            }
        });
    }

    next();
}

module.exports = {
    validateSyncRequest,
    validateOAuthCallback
};
