// TokenManager.js
// OAuth token lifecycle management for Strava API access
// Handles token retrieval, expiration checking, and refresh

const axios = require('axios');

class TokenManager {
    constructor(databaseClient, clientId, clientSecret) {
        if (!databaseClient) {
            throw new Error('DatabaseClient is required');
        }
        if (!clientId || !clientSecret) {
            throw new Error('Strava client ID and secret are required');
        }

        this.db = databaseClient;
        this.clientId = clientId;
        this.clientSecret = clientSecret;
    }

    // ============================================================================
    // Token Retrieval
    // ============================================================================

    async getValidTokens(athleteId) {
        const tokens = await this.db.getOAuthTokens(athleteId);

        if (!tokens) {
            throw new Error(`No OAuth tokens found for athlete ${athleteId}`);
        }

        // Check if token is expired or will expire in next 5 minutes
        const expiresAt = new Date(tokens.expires_at);
        const now = new Date();
        const fiveMinutesFromNow = new Date(now.getTime() + 5 * 60 * 1000);

        if (expiresAt <= fiveMinutesFromNow) {
            console.log(`Token expired or expiring soon for athlete ${athleteId}, refreshing...`);
            return await this.refreshTokens(athleteId, tokens.refresh_token);
        }

        return tokens;
    }

    // ============================================================================
    // Token Refresh
    // ============================================================================

    async refreshTokens(athleteId, refreshToken) {
        if (!refreshToken) {
            throw new Error('Refresh token is required');
        }

        try {
            console.log(`Refreshing OAuth tokens for athlete ${athleteId}...`);

            const response = await axios.post('https://www.strava.com/oauth/token', {
                client_id: this.clientId,
                client_secret: this.clientSecret,
                refresh_token: refreshToken,
                grant_type: 'refresh_token'
            });

            const {
                access_token,
                refresh_token: new_refresh_token,
                expires_at,
                expires_in
            } = response.data;

            // Calculate expires_at if not provided
            const expiresAt = expires_at
                ? new Date(expires_at * 1000)
                : new Date(Date.now() + expires_in * 1000);

            // Update database with new tokens
            const updatedTokens = await this.db.upsertOAuthTokens(athleteId, {
                access_token,
                refresh_token: new_refresh_token,
                expires_at: expiresAt.toISOString()
            });

            console.log(`Successfully refreshed tokens for athlete ${athleteId}`);

            return updatedTokens;

        } catch (error) {
            console.error(`Error refreshing tokens for athlete ${athleteId}:`, error.message);

            if (error.response) {
                const status = error.response.status;
                const message = error.response.data?.message || error.response.statusText;

                if (status === 401) {
                    throw new Error(`Token refresh failed: Invalid refresh token. User may need to re-authorize.`);
                }

                throw new Error(`Token refresh failed: ${status} ${message}`);
            }

            throw new Error(`Token refresh failed: ${error.message}`);
        }
    }

    // ============================================================================
    // Token Exchange (OAuth Flow)
    // ============================================================================

    async exchangeCodeForTokens(code) {
        if (!code) {
            throw new Error('Authorization code is required');
        }

        try {
            console.log('Exchanging authorization code for access tokens...');

            const response = await axios.post('https://www.strava.com/oauth/token', {
                client_id: this.clientId,
                client_secret: this.clientSecret,
                code: code,
                grant_type: 'authorization_code'
            });

            const {
                access_token,
                refresh_token,
                expires_at,
                expires_in,
                athlete
            } = response.data;

            // Calculate expires_at if not provided
            const expiresAt = expires_at
                ? new Date(expires_at * 1000)
                : new Date(Date.now() + expires_in * 1000);

            console.log(`Successfully obtained tokens for athlete ${athlete.id}`);

            return {
                access_token,
                refresh_token,
                expires_at: expiresAt,
                athlete
            };

        } catch (error) {
            console.error('Error exchanging authorization code:', error.message);

            if (error.response) {
                const status = error.response.status;
                const message = error.response.data?.message || error.response.statusText;
                throw new Error(`Token exchange failed: ${status} ${message}`);
            }

            throw new Error(`Token exchange failed: ${error.message}`);
        }
    }

    // ============================================================================
    // Token Validation
    // ============================================================================

    isExpired(expiresAt) {
        const expiration = new Date(expiresAt);
        const now = new Date();
        return expiration <= now;
    }

    willExpireSoon(expiresAt, minutesThreshold = 5) {
        const expiration = new Date(expiresAt);
        const threshold = new Date(Date.now() + minutesThreshold * 60 * 1000);
        return expiration <= threshold;
    }

    // ============================================================================
    // Authorization URL Generation
    // ============================================================================

    getAuthorizationUrl(redirectUri, scopes = ['activity:read_all'], state = null) {
        const params = new URLSearchParams({
            client_id: this.clientId,
            redirect_uri: redirectUri,
            response_type: 'code',
            scope: Array.isArray(scopes) ? scopes.join(',') : scopes,
            approval_prompt: 'auto'
        });

        if (state) {
            params.append('state', state);
        }

        return `https://www.strava.com/oauth/authorize?${params.toString()}`;
    }

    // ============================================================================
    // Token Storage
    // ============================================================================

    async storeTokens(athleteId, tokens) {
        return await this.db.upsertOAuthTokens(athleteId, tokens);
    }

    async revokeTokens(athleteId) {
        // Note: This only removes from database
        // To fully revoke on Strava side, would need to call deauthorization endpoint
        await this.db.deleteOAuthTokens(athleteId);
        console.log(`Removed tokens for athlete ${athleteId} from database`);
    }
}

module.exports = TokenManager;
