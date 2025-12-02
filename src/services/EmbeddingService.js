// EmbeddingService.js
// Handles creation and storage of activity embeddings using OpenAI

const logger = require('../utils/logger');
const ActivitySummarizer = require('./ActivitySummarizer');

class EmbeddingService {
    constructor(databaseClient, openaiApiKey) {
        if (!databaseClient) {
            throw new Error('DatabaseClient is required');
        }
        if (!openaiApiKey) {
            throw new Error('OpenAI API key is required');
        }

        this.db = databaseClient;
        this.openaiApiKey = openaiApiKey;
        this.embeddingModel = 'text-embedding-ada-002';
        this.embeddingDimension = 1536;
    }

    /**
     * Create embedding using OpenAI API
     */
    async createEmbedding(text) {
        try {
            const response = await fetch('https://api.openai.com/v1/embeddings', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${this.openaiApiKey}`
                },
                body: JSON.stringify({
                    model: this.embeddingModel,
                    input: text
                })
            });

            if (!response.ok) {
                const error = await response.text();
                throw new Error(`OpenAI API error: ${response.status} - ${error}`);
            }

            const data = await response.json();
            return data.data[0].embedding;

        } catch (error) {
            logger.error('Error creating embedding', {
                error: error.message
            });
            throw error;
        }
    }

    /**
     * Process and embed a single activity
     */
    async embedActivity(activity) {
        try {
            logger.info('Embedding activity', {
                activityId: activity.id,
                name: activity.name
            });

            // Generate summary optimized for embedding
            const summary = ActivitySummarizer.generateEmbeddingSummary(activity);

            // Create embedding
            const embedding = await this.createEmbedding(summary);

            // Store in database
            // pgvector expects the embedding as a string representation
            const embeddingString = `[${embedding.join(',')}]`;

            const { data, error } = await this.db.supabase
                .from('activity_embeddings')
                .upsert({
                    activity_id: activity.id,
                    summary: summary,
                    embedding: embeddingString,
                    updated_at: new Date().toISOString()
                }, {
                    onConflict: 'activity_id'
                })
                .select()
                .single();

            if (error) {
                throw new Error(`Database error: ${error.message}`);
            }

            logger.info('Activity embedded successfully', {
                activityId: activity.id,
                embeddingId: data.id
            });

            return data;

        } catch (error) {
            logger.error('Error embedding activity', {
                activityId: activity.id,
                error: error.message
            });
            throw error;
        }
    }

    /**
     * Batch embed multiple activities
     */
    async embedActivities(activities, options = {}) {
        const {
            batchSize = 10,
            delayMs = 1000, // Rate limiting delay
            onProgress = null
        } = options;

        const results = {
            success: 0,
            failed: 0,
            errors: []
        };

        logger.info('Starting batch embedding', {
            totalActivities: activities.length,
            batchSize
        });

        for (let i = 0; i < activities.length; i += batchSize) {
            const batch = activities.slice(i, i + batchSize);

            logger.info('Processing batch', {
                batchNumber: Math.floor(i / batchSize) + 1,
                batchSize: batch.length
            });

            // Process batch in parallel
            const batchPromises = batch.map(activity =>
                this.embedActivity(activity)
                    .then(() => {
                        results.success++;
                        return { success: true, activityId: activity.id };
                    })
                    .catch(error => {
                        results.failed++;
                        results.errors.push({
                            activityId: activity.id,
                            error: error.message
                        });
                        return { success: false, activityId: activity.id, error: error.message };
                    })
            );

            await Promise.all(batchPromises);

            // Progress callback
            if (onProgress) {
                onProgress({
                    processed: Math.min(i + batchSize, activities.length),
                    total: activities.length,
                    success: results.success,
                    failed: results.failed
                });
            }

            // Rate limiting delay between batches
            if (i + batchSize < activities.length) {
                await new Promise(resolve => setTimeout(resolve, delayMs));
            }
        }

        logger.info('Batch embedding completed', {
            total: activities.length,
            success: results.success,
            failed: results.failed
        });

        return results;
    }

    /**
     * Embed all activities for a specific athlete
     */
    async embedAthleteActivities(athleteId, options = {}) {
        logger.info('Embedding all activities for athlete', { athleteId });

        // Fetch all activities for the athlete
        const { data: activities, error } = await this.db.supabase
            .from('activities')
            .select('*')
            .eq('athlete_id', athleteId)
            .order('activity_date', { ascending: false });

        if (error) {
            throw new Error(`Error fetching activities: ${error.message}`);
        }

        logger.info('Fetched activities', {
            athleteId,
            count: activities.length
        });

        return await this.embedActivities(activities, options);
    }

    /**
     * Embed all un-embedded activities in the database
     */
    async embedMissingActivities(options = {}) {
        logger.info('Finding activities without embeddings');

        // First, get all activity IDs that already have embeddings
        const { data: embeddedActivityIds, error: embeddingError } = await this.db.supabase
            .from('activity_embeddings')
            .select('activity_id');

        if (embeddingError) {
            throw new Error(`Error fetching existing embeddings: ${embeddingError.message}`);
        }

        const embeddedIds = new Set((embeddedActivityIds || []).map(e => e.activity_id));

        logger.info('Found existing embeddings', {
            count: embeddedIds.size
        });

        // Fetch all activities
        const { data: allActivities, error } = await this.db.supabase
            .from('activities')
            .select('*')
            .order('activity_date', { ascending: false });

        if (error) {
            throw new Error(`Error fetching activities: ${error.message}`);
        }

        // Filter out activities that already have embeddings
        const activities = allActivities.filter(a => !embeddedIds.has(a.id));

        logger.info('Found activities without embeddings', {
            count: activities.length
        });

        if (activities.length === 0) {
            return { success: 0, failed: 0, errors: [] };
        }

        return await this.embedActivities(activities, options);
    }

    /**
     * Search for similar activities using vector similarity
     */
    async searchSimilarActivities(queryText, options = {}) {
        const {
            athleteId = null,
            limit = 10,
            threshold = 0.7
        } = options;

        logger.info('Searching for similar activities', {
            queryText,
            athleteId,
            limit
        });

        // Create embedding for the query
        const queryEmbedding = await this.createEmbedding(queryText);

        // Build query
        let query = this.db.supabase.rpc('match_activities', {
            query_embedding: queryEmbedding,
            match_threshold: threshold,
            match_count: limit
        });

        if (athleteId) {
            query = query.eq('athlete_id', athleteId);
        }

        const { data, error } = await query;

        if (error) {
            throw new Error(`Error searching activities: ${error.message}`);
        }

        logger.info('Found similar activities', {
            count: data?.length || 0
        });

        return data || [];
    }
}

module.exports = EmbeddingService;
