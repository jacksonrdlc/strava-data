// JobProcessor.js
// Core business logic for processing sync jobs
// Handles fetching activities from Strava, transforming data, and inserting to database
// Implements checkpoint-based resumption for long-running jobs

const { transformApiActivity } = require('../utils/transforms');
const { JOB_STATUS, STRAVA, BATCH_SIZE, MAX_EXECUTION_TIME } = require('../utils/constants');
const logger = require('../utils/logger');

class JobProcessor {
    constructor(databaseClient, stravaClient) {
        if (!databaseClient || !stravaClient) {
            throw new Error('DatabaseClient and StravaClient are required');
        }

        this.db = databaseClient;
        this.strava = stravaClient;
        this.maxExecutionTime = MAX_EXECUTION_TIME;
        this.batchSize = BATCH_SIZE;
    }

    // ============================================================================
    // Main Processing Method
    // ============================================================================

    async processJob(job) {
        const startTime = Date.now();

        logger.info('Starting job processing', {
            jobId: job.id,
            athleteId: job.athlete_id,
            syncType: job.sync_type
        });

        try {
            // Update job status to processing
            await this.db.updateJob(job.id, {
                status: JOB_STATUS.PROCESSING,
                started_at: new Date().toISOString()
            });

            // Get checkpoint from previous execution (if any)
            const startPage = job.metadata?.last_processed_page || 1;
            const totalProcessed = job.processed_activities || 0;

            logger.info('Job processing started', {
                jobId: job.id,
                startPage,
                totalProcessed
            });

            // Determine date filter for incremental sync
            let afterDate = null;
            if (job.sync_type === 'incremental' && job.after_date) {
                afterDate = Math.floor(new Date(job.after_date).getTime() / 1000);
            }

            // Process activities page by page
            const result = await this.fetchAndProcessActivities(
                job,
                startPage,
                totalProcessed,
                afterDate,
                startTime
            );

            // Mark job as completed
            await this.db.updateJob(job.id, {
                status: JOB_STATUS.COMPLETED,
                completed_at: new Date().toISOString(),
                total_activities: result.totalProcessed,
                processed_activities: result.totalProcessed,
                failed_activities: result.failed
            });

            // Update athlete sync timestamp
            await this.db.updateAthleteSync(job.athlete_id, true);

            logger.info('Job processing completed', {
                jobId: job.id,
                totalProcessed: result.totalProcessed,
                failed: result.failed
            });

            return result;

        } catch (error) {
            logger.error('Job processing failed', {
                jobId: job.id,
                error: error.message,
                stack: error.stack
            });

            // Mark job as failed
            await this.db.updateJob(job.id, {
                status: JOB_STATUS.FAILED,
                error_message: error.message,
                error_stack: error.stack,
                completed_at: new Date().toISOString()
            });

            // Update athlete sync timestamp (unsuccessful)
            await this.db.updateAthleteSync(job.athlete_id, false);

            throw error;
        }
    }

    // ============================================================================
    // Activity Fetching and Processing
    // ============================================================================

    async fetchAndProcessActivities(job, startPage, totalProcessed, afterDate, startTime) {
        let page = startPage;
        let processed = totalProcessed;
        let failed = 0;
        const failedActivityIds = [];
        const maxActivities = job.metadata?.max_activities || null;

        while (true) {
            // Check if max_activities limit has been reached
            if (maxActivities && processed >= maxActivities) {
                logger.info('Max activities limit reached', {
                    jobId: job.id,
                    processed,
                    maxActivities
                });
                break;
            }
            // Check if approaching timeout (with 2 minute buffer)
            const elapsedTime = Date.now() - startTime;
            if (elapsedTime > this.maxExecutionTime - 120000) {
                logger.warn('Approaching execution timeout, checkpointing...', {
                    jobId: job.id,
                    page,
                    elapsedTime
                });

                await this.saveCheckpoint(job.id, page, processed);
                return { totalProcessed: processed, failed, checkpointed: true };
            }

            logger.info('Fetching activities page', {
                jobId: job.id,
                page,
                afterDate
            });

            try {
                // Fetch page of activities from Strava
                let perPage = STRAVA.MAX_PER_PAGE;

                // If max_activities is set, adjust per_page to avoid fetching more than needed
                if (maxActivities) {
                    const remaining = maxActivities - processed;
                    perPage = Math.min(remaining, STRAVA.MAX_PER_PAGE);
                }

                const options = {
                    page,
                    per_page: perPage
                };

                if (afterDate) {
                    options.after = afterDate;
                }

                if (job.before_date) {
                    options.before = Math.floor(new Date(job.before_date).getTime() / 1000);
                }

                const activities = await this.strava.getActivities(options);

                if (activities.length === 0) {
                    logger.info('No more activities to fetch', { jobId: job.id, page });
                    break;
                }

                logger.info('Fetched activities', {
                    jobId: job.id,
                    page,
                    count: activities.length
                });

                // Transform activities to database format
                const transformed = activities.map(activity =>
                    transformApiActivity(activity, job.athlete_id)
                );

                // Insert activities in batches
                const insertResult = await this.db.batchInsertActivities(transformed, this.batchSize);

                processed += insertResult.success;
                failed += insertResult.failed;

                if (insertResult.errors.length > 0) {
                    logger.warn('Some activities failed to insert', {
                        jobId: job.id,
                        failedCount: insertResult.failed
                    });

                    // Track failed activity IDs
                    insertResult.errors.forEach((error, index) => {
                        if (error.detail) {
                            failedActivityIds.push(transformed[index]?.id);
                        }
                    });
                }

                // Update job progress
                await this.db.updateJob(job.id, {
                    processed_activities: processed,
                    failed_activities: failed,
                    metadata: {
                        ...job.metadata,
                        last_processed_page: page,
                        failed_activity_ids: failedActivityIds.slice(0, 100) // Limit to first 100
                    }
                });

                logger.info('Processed activities page', {
                    jobId: job.id,
                    page,
                    totalProcessed: processed,
                    totalFailed: failed
                });

                // If we got less than the full page, we're done
                if (activities.length < STRAVA.MAX_PER_PAGE) {
                    logger.info('Reached last page of activities', { jobId: job.id, page });
                    break;
                }

                page++;

                // Rate limiting: pause between requests
                await new Promise(resolve => setTimeout(resolve, STRAVA.REQUEST_DELAY_MS));

            } catch (error) {
                logger.error('Error fetching/processing activities page', {
                    jobId: job.id,
                    page,
                    error: error.message
                });

                // If it's a rate limit error, save checkpoint and re-queue
                if (error.message.includes('Rate limited')) {
                    await this.saveCheckpoint(job.id, page, processed);
                    throw new Error('Rate limited - job checkpointed for resume');
                }

                // For other errors, log and continue to next page
                logger.warn('Skipping page due to error, continuing...', {
                    jobId: job.id,
                    page
                });

                page++;
            }
        }

        return { totalProcessed: processed, failed, checkpointed: false };
    }

    // ============================================================================
    // Checkpoint Management
    // ============================================================================

    async saveCheckpoint(jobId, lastPage, processed) {
        logger.info('Saving checkpoint', {
            jobId,
            lastPage,
            processed
        });

        await this.db.updateJob(jobId, {
            status: JOB_STATUS.QUEUED, // Re-queue for next poll
            processed_activities: processed,
            metadata: {
                last_processed_page: lastPage,
                checkpointed_at: new Date().toISOString(),
                execution_count: (await this.db.getJob(jobId))?.metadata?.execution_count || 0 + 1
            }
        });

        logger.info('Checkpoint saved, job re-queued', { jobId });
    }
}

module.exports = JobProcessor;
