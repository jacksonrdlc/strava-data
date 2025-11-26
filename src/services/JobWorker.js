// JobWorker.js
// Background job worker that polls database for queued jobs
// Creates StravaClient per job with user's OAuth tokens and processes sync jobs

const StravaClient = require('./StravaClient');
const JobProcessor = require('./JobProcessor');
const { JOB_POLL_INTERVAL } = require('../utils/constants');
const logger = require('../utils/logger');

class JobWorker {
    constructor(databaseClient, tokenManager, pollInterval = JOB_POLL_INTERVAL) {
        if (!databaseClient || !tokenManager) {
            throw new Error('DatabaseClient and TokenManager are required');
        }

        this.db = databaseClient;
        this.tokenManager = tokenManager;
        this.pollInterval = pollInterval;
        this.isRunning = false;
        this.currentJob = null;
    }

    // ============================================================================
    // Worker Lifecycle
    // ============================================================================

    start() {
        if (this.isRunning) {
            logger.warn('JobWorker is already running');
            return;
        }

        this.isRunning = true;
        logger.info('JobWorker started', { pollInterval: this.pollInterval });
        this.poll();
    }

    stop() {
        this.isRunning = false;
        logger.info('JobWorker stopped');
    }

    // ============================================================================
    // Job Polling
    // ============================================================================

    async poll() {
        while (this.isRunning) {
            try {
                // Get next queued job
                const job = await this.db.getNextQueuedJob();

                if (job) {
                    logger.info('Found queued job', {
                        jobId: job.id,
                        athleteId: job.athlete_id,
                        syncType: job.sync_type
                    });

                    this.currentJob = job;
                    await this.processJob(job);
                    this.currentJob = null;
                } else {
                    // No jobs available, wait before polling again
                    logger.debug('No queued jobs found, waiting...');
                    await this.sleep(this.pollInterval);
                }

            } catch (error) {
                logger.error('JobWorker poll error', {
                    error: error.message,
                    stack: error.stack
                });

                // Wait before retrying to avoid rapid error loops
                await this.sleep(this.pollInterval);
            }
        }

        logger.info('JobWorker poll loop ended');
    }

    // ============================================================================
    // Job Processing
    // ============================================================================

    async processJob(job) {
        try {
            logger.info('Processing job', {
                jobId: job.id,
                athleteId: job.athlete_id
            });

            // Get valid OAuth tokens for the athlete
            const tokens = await this.tokenManager.getValidTokens(job.athlete_id);

            if (!tokens) {
                throw new Error(`No OAuth tokens found for athlete ${job.athlete_id}`);
            }

            // Create Strava client with user's tokens
            const stravaClient = new StravaClient({
                accessToken: tokens.access_token,
                refreshToken: tokens.refresh_token,
                clientId: this.tokenManager.clientId,
                clientSecret: this.tokenManager.clientSecret,
                onTokenRefresh: async (newTokens) => {
                    logger.info('Token refreshed during job processing', {
                        jobId: job.id,
                        athleteId: job.athlete_id
                    });

                    // Update tokens in database
                    await this.db.upsertOAuthTokens(job.athlete_id, newTokens);
                }
            });

            // Create job processor
            const processor = new JobProcessor(this.db, stravaClient);

            // Process the job
            const result = await processor.processJob(job);

            logger.info('Job processing completed successfully', {
                jobId: job.id,
                totalProcessed: result.totalProcessed,
                failed: result.failed,
                checkpointed: result.checkpointed
            });

            return result;

        } catch (error) {
            logger.error('Job processing failed', {
                jobId: job.id,
                error: error.message,
                stack: error.stack
            });

            // Error is already logged in JobProcessor
            // Don't re-throw to avoid crashing the worker
        }
    }

    // ============================================================================
    // Utility Methods
    // ============================================================================

    sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    getStatus() {
        return {
            isRunning: this.isRunning,
            pollInterval: this.pollInterval,
            currentJob: this.currentJob ? {
                id: this.currentJob.id,
                athleteId: this.currentJob.athlete_id,
                status: this.currentJob.status
            } : null
        };
    }

    // Graceful shutdown
    async shutdown() {
        logger.info('JobWorker shutting down...');

        this.stop();

        // Wait for current job to complete (with timeout)
        if (this.currentJob) {
            logger.info('Waiting for current job to complete...', {
                jobId: this.currentJob.id
            });

            const timeout = 30000; // 30 seconds
            const startTime = Date.now();

            while (this.currentJob && (Date.now() - startTime) < timeout) {
                await this.sleep(1000);
            }

            if (this.currentJob) {
                logger.warn('Current job did not complete within timeout', {
                    jobId: this.currentJob.id
                });
            } else {
                logger.info('Current job completed successfully');
            }
        }

        logger.info('JobWorker shutdown complete');
    }
}

module.exports = JobWorker;
