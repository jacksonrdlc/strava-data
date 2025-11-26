// sync.js
// POST /api/sync - Create sync job for a user

const express = require('express');
const { validateSyncRequest } = require('../middleware/validation');
const { ERROR_CODES, SYNC_TYPES } = require('../utils/constants');
const logger = require('../utils/logger');

const router = express.Router();

router.post('/', validateSyncRequest, async (req, res, next) => {
    try {
        const {
            user_id,
            sync_type = SYNC_TYPES.INCREMENTAL,
            after,
            before
        } = req.body;

        logger.info('Creating sync job', {
            user_id,
            sync_type,
            after,
            before
        });

        // Check if user has OAuth tokens
        const tokens = await req.db.getOAuthTokens(user_id);

        if (!tokens) {
            logger.warn('OAuth tokens not found for user', { user_id });

            return res.status(404).json({
                error: {
                    code: ERROR_CODES.TOKEN_NOT_FOUND,
                    message: `OAuth tokens not found for user ${user_id}. User needs to complete OAuth flow first.`
                }
            });
        }

        // Create sync job
        const job = await req.db.createJob(
            user_id,
            sync_type,
            after || null,
            before || null
        );

        logger.info('Sync job created', {
            jobId: job.id,
            user_id,
            sync_type
        });

        // Return job details
        res.status(201).json({
            job_id: job.id,
            status: job.status,
            sync_type: job.sync_type,
            created_at: job.created_at,
            user_id: user_id
        });

    } catch (error) {
        logger.error('Error creating sync job', {
            error: error.message,
            user_id: req.body.user_id
        });
        next(error);
    }
});

module.exports = router;
