// health.js
// GET /health - Health check endpoint

const express = require('express');
const logger = require('../utils/logger');

const router = express.Router();

router.get('/', async (req, res) => {
    try {
        const health = {
            status: 'ok',
            timestamp: new Date().toISOString(),
            uptime: process.uptime(),
            version: process.env.npm_package_version || '1.0.0'
        };

        // Optional: Check database connectivity
        if (req.db) {
            const dbHealth = await req.db.healthCheck();
            health.database = dbHealth.healthy ? 'connected' : 'disconnected';

            if (!dbHealth.healthy) {
                health.status = 'degraded';
                health.database_error = dbHealth.error;
            }
        }

        // Optional: Check worker status
        if (req.worker) {
            const workerStatus = req.worker.getStatus();
            health.worker = {
                running: workerStatus.isRunning,
                currentJob: workerStatus.currentJob?.id || null
            };
        }

        const statusCode = health.status === 'ok' ? 200 : 503;

        res.status(statusCode).json(health);

    } catch (error) {
        logger.error('Health check error', { error: error.message });

        res.status(503).json({
            status: 'error',
            timestamp: new Date().toISOString(),
            error: error.message
        });
    }
});

module.exports = router;
