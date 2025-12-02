// DatabaseClient.js
// Supabase database client wrapper for Cloud Run service
// Provides methods for OAuth tokens, sync jobs, activities, and athletes

const { createClient } = require('@supabase/supabase-js');

class DatabaseClient {
    constructor(supabaseUrl, supabaseKey) {
        if (!supabaseUrl || !supabaseKey) {
            throw new Error('Supabase URL and key are required');
        }

        this.supabase = createClient(supabaseUrl, supabaseKey);
    }

    // ============================================================================
    // OAuth Token Methods
    // ============================================================================

    async getOAuthTokens(athleteId) {
        const { data, error } = await this.supabase
            .from('oauth_tokens')
            .select('*')
            .eq('athlete_id', athleteId)
            .single();

        if (error) {
            if (error.code === 'PGRST116') {
                // No rows returned
                return null;
            }
            throw new Error(`Error fetching OAuth tokens: ${error.message}`);
        }

        return data;
    }

    async upsertOAuthTokens(athleteId, tokens) {
        const {
            access_token,
            refresh_token,
            expires_at,
            scope = 'activity:read_all',
            token_type = 'Bearer'
        } = tokens;

        // Convert expires_at to Date if it's a timestamp number
        const expiresAtDate = typeof expires_at === 'number'
            ? new Date(expires_at * 1000).toISOString()
            : expires_at;

        const { data, error } = await this.supabase
            .from('oauth_tokens')
            .upsert({
                athlete_id: athleteId,
                access_token,
                refresh_token,
                expires_at: expiresAtDate,
                scope,
                token_type,
                updated_at: new Date().toISOString()
            }, {
                onConflict: 'athlete_id'
            })
            .select()
            .single();

        if (error) {
            throw new Error(`Error upserting OAuth tokens: ${error.message}`);
        }

        return data;
    }

    async deleteOAuthTokens(athleteId) {
        const { error } = await this.supabase
            .from('oauth_tokens')
            .delete()
            .eq('athlete_id', athleteId);

        if (error) {
            throw new Error(`Error deleting OAuth tokens: ${error.message}`);
        }
    }

    // ============================================================================
    // Sync Job Methods
    // ============================================================================

    async createJob(athleteId, syncType = 'incremental', afterDate = null, beforeDate = null, metadata = {}) {
        const { data, error} = await this.supabase
            .from('sync_jobs')
            .insert({
                athlete_id: athleteId,
                sync_type: syncType,
                status: 'queued',
                after_date: afterDate,
                before_date: beforeDate,
                metadata: metadata
            })
            .select()
            .single();

        if (error) {
            throw new Error(`Error creating sync job: ${error.message}`);
        }

        return data;
    }

    async getJob(jobId) {
        const { data, error } = await this.supabase
            .from('sync_jobs')
            .select('*')
            .eq('id', jobId)
            .single();

        if (error) {
            if (error.code === 'PGRST116') {
                return null;
            }
            throw new Error(`Error fetching job: ${error.message}`);
        }

        return data;
    }

    async updateJob(jobId, updates) {
        const { data, error } = await this.supabase
            .from('sync_jobs')
            .update({
                ...updates,
                updated_at: new Date().toISOString()
            })
            .eq('id', jobId)
            .select()
            .single();

        if (error) {
            throw new Error(`Error updating job: ${error.message}`);
        }

        return data;
    }

    async getNextQueuedJob() {
        // Use RPC to get next queued job with row-level lock
        // This prevents race conditions when multiple workers poll simultaneously
        const { data, error } = await this.supabase.rpc('get_next_queued_job');

        if (error) {
            // If RPC doesn't exist, fall back to simple query
            console.warn('RPC get_next_queued_job not found, using simple query');
            return await this._getNextQueuedJobFallback();
        }

        return data;
    }

    async _getNextQueuedJobFallback() {
        const { data, error } = await this.supabase
            .from('sync_jobs')
            .select('*')
            .eq('status', 'queued')
            .order('created_at', { ascending: true })
            .limit(1)
            .single();

        if (error) {
            if (error.code === 'PGRST116') {
                return null;
            }
            throw new Error(`Error fetching next queued job: ${error.message}`);
        }

        return data;
    }

    async listJobs(athleteId, options = {}) {
        const {
            status = null,
            limit = 50,
            offset = 0
        } = options;

        let query = this.supabase
            .from('sync_jobs')
            .select('*', { count: 'exact' })
            .eq('athlete_id', athleteId)
            .order('created_at', { ascending: false })
            .range(offset, offset + limit - 1);

        if (status) {
            query = query.eq('status', status);
        }

        const { data, error, count } = await query;

        if (error) {
            throw new Error(`Error listing jobs: ${error.message}`);
        }

        return { jobs: data, total: count };
    }

    // ============================================================================
    // Activity Methods
    // ============================================================================

    async batchInsertActivities(activities, batchSize = 50) {
        const results = {
            success: 0,
            failed: 0,
            errors: []
        };

        // Process in batches
        for (let i = 0; i < activities.length; i += batchSize) {
            const batch = activities.slice(i, i + batchSize);

            try {
                const { data, error } = await this.supabase
                    .from('activities')
                    .upsert(batch, {
                        onConflict: 'id',
                        ignoreDuplicates: false
                    });

                if (error) {
                    console.error(`Error in batch ${i / batchSize + 1}:`, error);
                    results.failed += batch.length;
                    results.errors.push(error);
                } else {
                    results.success += batch.length;
                }
            } catch (error) {
                console.error(`Exception in batch ${i / batchSize + 1}:`, error);
                results.failed += batch.length;
                results.errors.push(error);
            }

            // Small delay between batches to avoid rate limiting
            await new Promise(resolve => setTimeout(resolve, 100));
        }

        return results;
    }

    async getActivity(activityId) {
        const { data, error } = await this.supabase
            .from('activities')
            .select('*')
            .eq('id', activityId)
            .single();

        if (error) {
            if (error.code === 'PGRST116') {
                return null;
            }
            throw new Error(`Error fetching activity: ${error.message}`);
        }

        return data;
    }

    async getActivitiesCount(athleteId) {
        const { count, error } = await this.supabase
            .from('activities')
            .select('*', { count: 'exact', head: true })
            .eq('athlete_id', athleteId);

        if (error) {
            throw new Error(`Error counting activities: ${error.message}`);
        }

        return count;
    }

    async getLatestActivityDate(athleteId) {
        const { data, error } = await this.supabase
            .from('activities')
            .select('activity_date')
            .eq('athlete_id', athleteId)
            .order('activity_date', { ascending: false })
            .limit(1)
            .single();

        if (error) {
            if (error.code === 'PGRST116') {
                return null;
            }
            throw new Error(`Error fetching latest activity date: ${error.message}`);
        }

        return data?.activity_date;
    }

    // ============================================================================
    // Athlete Methods
    // ============================================================================

    async getAthlete(athleteId) {
        const { data, error } = await this.supabase
            .from('athletes')
            .select('*')
            .eq('id', athleteId)
            .single();

        if (error) {
            if (error.code === 'PGRST116') {
                return null;
            }
            throw new Error(`Error fetching athlete: ${error.message}`);
        }

        return data;
    }

    async upsertAthlete(athleteData) {
        const {
            id,
            username = null,
            first_name = null,
            last_name = null,
            city = null,
            state = null,
            country = null,
            sex = null,
            premium = false,
            summit = false,
            created_at = null,
            updated_at = null,
            follower_count = null,
            friend_count = null,
            resource_state = 2
        } = athleteData;

        if (!id) {
            throw new Error('Athlete ID is required');
        }

        const { data, error } = await this.supabase
            .from('athletes')
            .upsert({
                id,
                username,
                first_name,
                last_name,
                city,
                state,
                country,
                sex,
                premium,
                summit,
                created_at,
                updated_at: new Date().toISOString(),
                follower_count,
                friend_count,
                resource_state
            }, {
                onConflict: 'id'
            })
            .select()
            .single();

        if (error) {
            throw new Error(`Error upserting athlete: ${error.message}`);
        }

        return data;
    }

    async updateAthleteSync(athleteId, successful = true) {
        const updates = {
            last_sync_at: new Date().toISOString()
        };

        if (successful) {
            updates.last_successful_sync_at = new Date().toISOString();

            // Increment total_syncs counter
            const athlete = await this.getAthlete(athleteId);
            updates.total_syncs = (athlete?.total_syncs || 0) + 1;
        }

        const { data, error } = await this.supabase
            .from('athletes')
            .update(updates)
            .eq('id', athleteId)
            .select()
            .single();

        if (error) {
            throw new Error(`Error updating athlete sync: ${error.message}`);
        }

        return data;
    }

    // ============================================================================
    // Health Check
    // ============================================================================

    async healthCheck() {
        try {
            // Simple query to verify database connectivity
            const { error } = await this.supabase
                .from('athletes')
                .select('count')
                .limit(1);

            if (error) {
                throw error;
            }

            return { healthy: true };
        } catch (error) {
            return { healthy: false, error: error.message };
        }
    }
}

module.exports = DatabaseClient;
