// StravaClient.js
// Refactored Strava API client for Cloud Run service
// Accepts tokens as constructor params and includes token refresh callback

const axios = require('axios');

class StravaClient {
    constructor(options) {
        const {
            accessToken,
            refreshToken,
            clientId,
            clientSecret,
            onTokenRefresh = null
        } = options;

        if (!accessToken) {
            throw new Error('Access token is required');
        }

        this.accessToken = accessToken;
        this.refreshToken = refreshToken;
        this.clientId = clientId;
        this.clientSecret = clientSecret;
        this.onTokenRefresh = onTokenRefresh;

        this.baseURL = 'https://www.strava.com/api/v3';

        // Rate limiting info from Strava
        this.rateLimit = {
            shortTerm: { limit: 100, period: 900 }, // 100 requests per 15 minutes
            longTerm: { limit: 1000, period: 86400 } // 1000 requests per day
        };

        this.requestCount = { shortTerm: 0, longTerm: 0 };
    }

    // ============================================================================
    // Token Refresh
    // ============================================================================

    async refreshAccessToken() {
        if (!this.refreshToken || !this.clientId || !this.clientSecret) {
            throw new Error('Refresh token, client ID, and client secret required for token refresh');
        }

        try {
            console.log('Refreshing Strava access token...');

            const response = await axios.post('https://www.strava.com/oauth/token', {
                client_id: this.clientId,
                client_secret: this.clientSecret,
                refresh_token: this.refreshToken,
                grant_type: 'refresh_token'
            });

            const {
                access_token,
                refresh_token,
                expires_at,
                expires_in
            } = response.data;

            // Update internal tokens
            this.accessToken = access_token;
            this.refreshToken = refresh_token;

            // Calculate expires_at if not provided
            const expiresAt = expires_at
                ? new Date(expires_at * 1000)
                : new Date(Date.now() + expires_in * 1000);

            console.log('Access token refreshed successfully');

            // Callback to update tokens in database
            if (this.onTokenRefresh) {
                await this.onTokenRefresh({
                    access_token,
                    refresh_token,
                    expires_at: expiresAt.toISOString()
                });
            }

            return { access_token, refresh_token, expires_at: expiresAt };

        } catch (error) {
            console.error('Error refreshing token:', error.message);
            throw error;
        }
    }

    // ============================================================================
    // API Requests
    // ============================================================================

    async makeRequest(endpoint, params = {}, retryCount = 0) {
        if (!this.accessToken) {
            throw new Error('No access token available');
        }

        // Simple rate limiting check
        if (this.requestCount.shortTerm >= this.rateLimit.shortTerm.limit) {
            console.warn('Approaching short-term rate limit. Consider adding delays.');
        }

        try {
            const url = `${this.baseURL}${endpoint}`;
            const response = await axios.get(url, {
                headers: {
                    'Authorization': `Bearer ${this.accessToken}`
                },
                params
            });

            // Track rate limit usage from headers
            if (response.headers['x-ratelimit-usage']) {
                const usage = response.headers['x-ratelimit-usage'].split(',');
                this.requestCount.shortTerm = parseInt(usage[0]) || 0;
                this.requestCount.longTerm = parseInt(usage[1]) || 0;
            }

            if (response.headers['x-ratelimit-limit']) {
                const limits = response.headers['x-ratelimit-limit'].split(',');
                this.rateLimit.shortTerm.limit = parseInt(limits[0]) || 100;
                this.rateLimit.longTerm.limit = parseInt(limits[1]) || 1000;
            }

            return response.data;

        } catch (error) {
            // Handle 401 Unauthorized (token expired)
            if (error.response?.status === 401 && retryCount === 0) {
                console.log('Access token expired, attempting refresh...');
                await this.refreshAccessToken();
                // Retry the request once with new token
                return this.makeRequest(endpoint, params, retryCount + 1);
            }

            // Handle 429 Rate Limit
            if (error.response?.status === 429) {
                const retryAfter = error.response.headers['retry-after'] || 60;
                console.warn(`Rate limited. Retry after ${retryAfter} seconds`);
                throw new Error(`Rate limited. Retry after ${retryAfter} seconds`);
            }

            throw error;
        }
    }

    // ============================================================================
    // Athlete Methods
    // ============================================================================

    async getAthlete() {
        return this.makeRequest('/athlete');
    }

    async getAthleteStats(athleteId) {
        return this.makeRequest(`/athletes/${athleteId}/stats`);
    }

    // ============================================================================
    // Activity Methods
    // ============================================================================

    async getActivities(options = {}) {
        const {
            before,
            after,
            page = 1,
            per_page = 30
        } = options;

        const params = { page, per_page };
        if (before) params.before = before;
        if (after) params.after = after;

        return this.makeRequest('/athlete/activities', params);
    }

    async getAllActivities(options = {}) {
        const activities = [];
        let page = 1;
        const perPage = 200; // Max per page

        console.log('Fetching all activities from Strava API...');

        while (true) {
            try {
                console.log(`  Fetching page ${page}...`);

                const pageActivities = await this.getActivities({
                    ...options,
                    page,
                    per_page: perPage
                });

                if (pageActivities.length === 0) {
                    break; // No more activities
                }

                activities.push(...pageActivities);
                console.log(`  Got ${pageActivities.length} activities (total: ${activities.length})`);

                // If we got less than the full page, we're done
                if (pageActivities.length < perPage) {
                    break;
                }

                page++;

                // Rate limiting: pause between requests
                await new Promise(resolve => setTimeout(resolve, 200));

            } catch (error) {
                console.error(`Error fetching page ${page}:`, error.message);

                // If it's a rate limit error, re-throw to be handled by caller
                if (error.message.includes('Rate limited')) {
                    throw error;
                }

                // For other errors, log and break
                break;
            }
        }

        console.log(`Fetched ${activities.length} total activities from Strava API`);
        return activities;
    }

    async getActivity(activityId, includeAllEfforts = false) {
        const params = {};
        if (includeAllEfforts) {
            params.include_all_efforts = true;
        }
        return this.makeRequest(`/activities/${activityId}`, params);
    }

    // ============================================================================
    // Rate Limit Status
    // ============================================================================

    getRateLimitStatus() {
        return {
            shortTerm: {
                used: this.requestCount.shortTerm,
                limit: this.rateLimit.shortTerm.limit,
                remaining: this.rateLimit.shortTerm.limit - this.requestCount.shortTerm
            },
            longTerm: {
                used: this.requestCount.longTerm,
                limit: this.rateLimit.longTerm.limit,
                remaining: this.rateLimit.longTerm.limit - this.requestCount.longTerm
            }
        };
    }

    // ============================================================================
    // Utility Methods
    // ============================================================================

    updateTokens(accessToken, refreshToken) {
        this.accessToken = accessToken;
        this.refreshToken = refreshToken;
    }
}

module.exports = StravaClient;
