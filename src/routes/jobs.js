// jobs.js
// GET /api/jobs/:jobId - Get sync job status

const express = require('express');
const { ERROR_CODES } = require('../utils/constants');
const logger = require('../utils/logger');

const router = express.Router();

router.get('/:jobId', async (req, res, next) => {
    try {
        const { jobId } = req.params;

        logger.debug('Fetching job status', { jobId });

        // Get job from database
        const job = await req.db.getJob(jobId);

        if (!job) {
            logger.warn('Job not found', { jobId });

            return res.status(404).json({
                error: {
                    code: ERROR_CODES.JOB_NOT_FOUND,
                    message: `Job ${jobId} not found`
                }
            });
        }

        // Return job status
        res.json({
            job_id: job.id,
            user_id: job.athlete_id,
            status: job.status,
            sync_type: job.sync_type,
            created_at: job.created_at,
            started_at: job.started_at,
            completed_at: job.completed_at,
            progress: {
                total: job.total_activities,
                processed: job.processed_activities,
                failed: job.failed_activities
            },
            error: job.error_message,
            after_date: job.after_date,
            before_date: job.before_date
        });

    } catch (error) {
        logger.error('Error fetching job', {
            error: error.message,
            jobId: req.params.jobId
        });
        next(error);
    }
});

module.exports = router;
