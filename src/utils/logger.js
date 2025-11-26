// logger.js
// Structured logging utility for Cloud Run service

const LOG_LEVELS = {
    DEBUG: 0,
    INFO: 1,
    WARN: 2,
    ERROR: 3
};

const currentLogLevel = LOG_LEVELS[process.env.LOG_LEVEL?.toUpperCase()] || LOG_LEVELS.INFO;

function log(level, message, meta = {}) {
    if (LOG_LEVELS[level] < currentLogLevel) {
        return;
    }

    const logEntry = {
        timestamp: new Date().toISOString(),
        level,
        message,
        ...meta
    };

    // Cloud Run will capture JSON logs
    console.log(JSON.stringify(logEntry));
}

module.exports = {
    debug: (message, meta) => log('DEBUG', message, meta),
    info: (message, meta) => log('INFO', message, meta),
    warn: (message, meta) => log('WARN', message, meta),
    error: (message, meta) => log('ERROR', message, meta)
};
