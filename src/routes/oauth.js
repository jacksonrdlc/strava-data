// oauth.js
// OAuth flow routes for Strava authentication

const express = require('express');
const { validateOAuthCallback } = require('../middleware/validation');
const { transformAthleteData } = require('../utils/transforms');
const logger = require('../utils/logger');

const router = express.Router();

/**
 * GET /api/oauth/authorize
 * Redirect to Strava OAuth authorization page
 */
router.get('/authorize', (req, res) => {
    try {
        const redirectUri = process.env.OAUTH_REDIRECT_URI;

        if (!redirectUri) {
            throw new Error('OAUTH_REDIRECT_URI not configured');
        }

        const state = req.query.state || generateState();

        const authUrl = req.tokenManager.getAuthorizationUrl(
            redirectUri,
            ['activity:read_all'],
            state
        );

        logger.info('Redirecting to Strava OAuth', { state });

        res.redirect(authUrl);

    } catch (error) {
        logger.error('Error generating OAuth URL', { error: error.message });
        res.status(500).send('OAuth configuration error');
    }
});

/**
 * GET /api/oauth/callback
 * Handle OAuth callback from Strava
 */
router.get('/callback', validateOAuthCallback, async (req, res, next) => {
    try {
        const { code, state } = req.query;

        logger.info('Received OAuth callback', { state });

        // Exchange code for tokens
        const result = await req.tokenManager.exchangeCodeForTokens(code);

        const { access_token, refresh_token, expires_at, athlete } = result;

        logger.info('OAuth tokens obtained', {
            athleteId: athlete.id,
            athleteName: `${athlete.firstname} ${athlete.lastname}`
        });

        // Transform athlete data
        const athleteData = transformAthleteData(athlete);

        // Store athlete in database
        await req.db.upsertAthlete(athleteData);

        // Store OAuth tokens
        await req.db.upsertOAuthTokens(athlete.id, {
            access_token,
            refresh_token,
            expires_at: expires_at.toISOString()
        });

        logger.info('Athlete and tokens stored', { athleteId: athlete.id });

        // Return success page
        res.send(`
            <!DOCTYPE html>
            <html>
            <head>
                <title>Strava Authorization Success</title>
                <style>
                    body {
                        font-family: Arial, sans-serif;
                        max-width: 600px;
                        margin: 100px auto;
                        padding: 20px;
                        text-align: center;
                    }
                    .success {
                        color: #28a745;
                        font-size: 24px;
                        margin-bottom: 20px;
                    }
                    .info {
                        background: #f8f9fa;
                        padding: 20px;
                        border-radius: 5px;
                        margin: 20px 0;
                    }
                    code {
                        background: #e9ecef;
                        padding: 2px 6px;
                        border-radius: 3px;
                        font-family: monospace;
                    }
                </style>
            </head>
            <body>
                <div class="success">✓ Authorization Successful!</div>
                <p>Your Strava account has been connected.</p>
                <div class="info">
                    <p><strong>Athlete:</strong> ${athlete.firstname} ${athlete.lastname}</p>
                    <p><strong>Athlete ID:</strong> <code>${athlete.id}</code></p>
                </div>
                <p>You can now trigger sync jobs using your athlete ID.</p>
                <p><small>You can safely close this window.</small></p>
            </body>
            </html>
        `);

    } catch (error) {
        logger.error('OAuth callback error', {
            error: error.message,
            stack: error.stack
        });

        res.status(500).send(`
            <!DOCTYPE html>
            <html>
            <head>
                <title>Strava Authorization Error</title>
                <style>
                    body {
                        font-family: Arial, sans-serif;
                        max-width: 600px;
                        margin: 100px auto;
                        padding: 20px;
                        text-align: center;
                    }
                    .error {
                        color: #dc3545;
                        font-size: 24px;
                        margin-bottom: 20px;
                    }
                </style>
            </head>
            <body>
                <div class="error">✗ Authorization Failed</div>
                <p>There was an error connecting your Strava account.</p>
                <p><small>${error.message}</small></p>
                <p><a href="/api/oauth/authorize">Try again</a></p>
            </body>
            </html>
        `);
    }
});

/**
 * Generate random state for CSRF protection
 */
function generateState() {
    return Math.random().toString(36).substring(2, 15);
}

module.exports = router;
