// constants.js
// Application constants for Cloud Run service

module.exports = {
    // Job statuses
    JOB_STATUS: {
        QUEUED: 'queued',
        PROCESSING: 'processing',
        COMPLETED: 'completed',
        FAILED: 'failed'
    },

    // Sync types
    SYNC_TYPES: {
        FULL: 'full',
        INCREMENTAL: 'incremental'
    },

    // Strava API limits
    STRAVA: {
        MAX_PER_PAGE: 200,
        DEFAULT_PER_PAGE: 30,
        RATE_LIMIT_SHORT_TERM: 100, // 100 requests per 15 minutes
        RATE_LIMIT_LONG_TERM: 1000, // 1000 requests per day
        REQUEST_DELAY_MS: 200 // Delay between paginated requests
    },

    // Database batch processing
    BATCH_SIZE: parseInt(process.env.BATCH_SIZE) || 50,

    // Job processing
    JOB_POLL_INTERVAL: parseInt(process.env.JOB_POLL_INTERVAL) || 5000, // 5 seconds
    MAX_EXECUTION_TIME: parseInt(process.env.MAX_EXECUTION_TIME) || 3300000, // 55 minutes in ms

    // Error codes
    ERROR_CODES: {
        UNAUTHORIZED: 'UNAUTHORIZED',
        TOKEN_NOT_FOUND: 'TOKEN_NOT_FOUND',
        TOKEN_EXPIRED: 'TOKEN_EXPIRED',
        INVALID_REQUEST: 'INVALID_REQUEST',
        JOB_NOT_FOUND: 'JOB_NOT_FOUND',
        RATE_LIMITED: 'RATE_LIMITED',
        INTERNAL_ERROR: 'INTERNAL_ERROR'
    }
};
