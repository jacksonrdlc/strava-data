// Strava API Client
const axios = require('axios');
require('dotenv').config({ path: './config/.env' });

class StravaClient {
    constructor() {
        this.clientId = process.env.STRAVA_CLIENT_ID;
        this.clientSecret = process.env.STRAVA_CLIENT_SECRET;
        this.accessToken = process.env.STRAVA_ACCESS_TOKEN;
        this.refreshToken = process.env.STRAVA_REFRESH_TOKEN;

        this.baseURL = 'https://www.strava.com/api/v3';

        // Rate limiting info
        this.rateLimit = {
            shortTerm: { limit: 100, period: 900 }, // 100 requests per 15 minutes
            longTerm: { limit: 1000, period: 86400 } // 1000 requests per day
        };

        this.requestCount = { shortTerm: 0, longTerm: 0 };
    }

    /**
     * Get OAuth authorization URL for initial setup
     */
    getAuthorizationUrl(scopes = ['read', 'activity:read_all']) {
        const params = new URLSearchParams({
            client_id: this.clientId,
            redirect_uri: 'http://localhost:3000/callback', // You can change this
            response_type: 'code',
            scope: scopes.join(','),
            approval_prompt: 'force'
        });

        return `https://www.strava.com/oauth/authorize?${params.toString()}`;
    }

    /**
     * Exchange authorization code for access token
     */
    async exchangeCodeForToken(code) {
        try {
            const response = await axios.post('https://www.strava.com/oauth/token', {
                client_id: this.clientId,
                client_secret: this.clientSecret,
                code: code,
                grant_type: 'authorization_code'
            });

            const { access_token, refresh_token, athlete } = response.data;

            console.log('🎉 Successfully obtained tokens!');
            console.log('Add these to your .env file:');
            console.log(`STRAVA_ACCESS_TOKEN="${access_token}"`);
            console.log(`STRAVA_REFRESH_TOKEN="${refresh_token}"`);

            return { access_token, refresh_token, athlete };
        } catch (error) {
            console.error('❌ Error exchanging code for token:', error.response?.data || error.message);
            throw error;
        }
    }

    /**
     * Refresh access token using refresh token
     */
    async refreshAccessToken() {
        if (!this.refreshToken) {
            throw new Error('No refresh token available. Need to re-authorize.');
        }

        try {
            const response = await axios.post('https://www.strava.com/oauth/token', {
                client_id: this.clientId,
                client_secret: this.clientSecret,
                refresh_token: this.refreshToken,
                grant_type: 'refresh_token'
            });

            const { access_token, refresh_token } = response.data;

            this.accessToken = access_token;
            this.refreshToken = refresh_token;

            console.log('✅ Access token refreshed successfully');
            console.log('Update your .env file:');
            console.log(`STRAVA_ACCESS_TOKEN="${access_token}"`);
            console.log(`STRAVA_REFRESH_TOKEN="${refresh_token}"`);

            return { access_token, refresh_token };
        } catch (error) {
            console.error('❌ Error refreshing token:', error.response?.data || error.message);
            throw error;
        }
    }

    /**
     * Make authenticated API request
     */
    async makeRequest(endpoint, params = {}) {
        if (!this.accessToken) {
            throw new Error('No access token available. Need to authorize first.');
        }

        // Simple rate limiting check
        if (this.requestCount.shortTerm >= this.rateLimit.shortTerm.limit) {
            console.warn('⚠️  Approaching short-term rate limit. Consider adding delays.');
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
                this.requestCount.shortTerm = parseInt(usage[0]);
                this.requestCount.longTerm = parseInt(usage[1]);
            }

            return response.data;
        } catch (error) {
            if (error.response?.status === 401) {
                console.log('🔄 Access token expired, attempting refresh...');
                await this.refreshAccessToken();
                // Retry the request with new token
                return this.makeRequest(endpoint, params);
            }
            throw error;
        }
    }

    /**
     * Get authenticated athlete info
     */
    async getAthlete() {
        return this.makeRequest('/athlete');
    }

    /**
     * Get athlete activities with pagination
     */
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

    /**
     * Get all activities (handles pagination automatically)
     */
    async getAllActivities(options = {}) {
        const activities = [];
        let page = 1;
        const perPage = 200; // Max per page

        console.log('📊 Fetching all activities from Strava API...');

        while (true) {
            try {
                console.log(`   Fetching page ${page}...`);

                const pageActivities = await this.getActivities({
                    ...options,
                    page,
                    per_page: perPage
                });

                if (pageActivities.length === 0) {
                    break; // No more activities
                }

                activities.push(...pageActivities);
                console.log(`   ✅ Got ${pageActivities.length} activities (total: ${activities.length})`);

                // If we got less than the full page, we're done
                if (pageActivities.length < perPage) {
                    break;
                }

                page++;

                // Rate limiting: pause between requests
                await new Promise(resolve => setTimeout(resolve, 200));

            } catch (error) {
                console.error(`❌ Error fetching page ${page}:`, error.message);
                break;
            }
        }

        console.log(`🎉 Fetched ${activities.length} total activities from Strava API`);
        return activities;
    }

    /**
     * Get detailed activity by ID
     */
    async getActivity(activityId) {
        return this.makeRequest(`/activities/${activityId}`);
    }

    /**
     * Get athlete stats
     */
    async getAthleteStats(athleteId) {
        return this.makeRequest(`/athletes/${athleteId}/stats`);
    }

    /**
     * Check rate limit status
     */
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
}

module.exports = StravaClient;