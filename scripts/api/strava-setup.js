// Strava API Setup and Data Fetching
const StravaClient = require('./strava-client');
const fs = require('fs').promises;

async function setupStravaAPI() {
    console.log('🚀 Strava API Setup and Authentication\n');

    const client = new StravaClient();

    // Check if we already have tokens
    if (!client.accessToken) {
        console.log('⚠️  No access token found in environment variables.');
        console.log('🔗 You need to authorize this application with Strava.\n');

        console.log('Step 1: Get Authorization Code');
        console.log('📋 Copy this URL and open it in your browser:');
        console.log('-------------------------------------------');
        console.log(client.getAuthorizationUrl(['read', 'activity:read_all']));
        console.log('-------------------------------------------\n');

        console.log('Step 2: After authorization, you\'ll be redirected to a URL like:');
        console.log('http://localhost:3000/callback?state=&code=AUTHORIZATION_CODE&scope=read,activity:read_all');
        console.log('\nStep 3: Copy the AUTHORIZATION_CODE from the URL and run:');
        console.log('node scripts/api/strava-setup.js AUTHORIZATION_CODE\n');

        return;
    }

    // If we have tokens, test the connection
    try {
        console.log('🔍 Testing Strava API connection...');

        const athlete = await client.getAthlete();
        console.log(`✅ Connected to Strava API successfully!`);
        console.log(`👤 Athlete: ${athlete.firstname} ${athlete.lastname}`);
        console.log(`📍 Location: ${athlete.city}, ${athlete.state}, ${athlete.country}`);
        console.log(`🏃 Follower count: ${athlete.follower_count}`);

        // Get recent activities sample
        console.log('\n📊 Fetching recent activities...');
        const recentActivities = await client.getActivities({ per_page: 5 });

        console.log(`✅ Found ${recentActivities.length} recent activities:`);
        recentActivities.forEach((activity, index) => {
            const distance = activity.distance ? (activity.distance / 1000).toFixed(2) + 'km' : 'N/A';
            const date = new Date(activity.start_date).toLocaleDateString();
            console.log(`   ${index + 1}. ${activity.name} - ${distance} (${date})`);
        });

        // Check rate limits
        const rateLimits = client.getRateLimitStatus();
        console.log('\n📈 Rate Limit Status:');
        console.log(`   Short-term: ${rateLimits.shortTerm.used}/${rateLimits.shortTerm.limit} (${rateLimits.shortTerm.remaining} remaining)`);
        console.log(`   Long-term: ${rateLimits.longTerm.used}/${rateLimits.longTerm.limit} (${rateLimits.longTerm.remaining} remaining)`);

        return client;

    } catch (error) {
        console.error('❌ Error connecting to Strava API:', error.message);

        if (error.response?.status === 401) {
            console.log('🔄 Access token may be expired. Attempting refresh...');
            try {
                await client.refreshAccessToken();
                console.log('✅ Token refreshed successfully. Try running the command again.');
            } catch (refreshError) {
                console.error('❌ Could not refresh token. You may need to re-authorize.');
                console.log('\n🔗 Re-run authorization with:');
                console.log(client.getAuthorizationUrl(['read', 'activity:read_all']));
            }
        }
    }
}

async function exchangeAuthCode(code) {
    console.log('🔄 Exchanging authorization code for access token...\n');

    const client = new StravaClient();

    try {
        const tokens = await client.exchangeCodeForToken(code);

        console.log('\n✅ Authentication successful!');
        console.log(`👤 Athlete: ${tokens.athlete.firstname} ${tokens.athlete.lastname}`);
        console.log('\n📝 Add these lines to your config/.env file:');
        console.log('-------------------------------------------');
        console.log(`STRAVA_CLIENT_SECRET="your_client_secret_here"`);
        console.log(`STRAVA_ACCESS_TOKEN="${tokens.access_token}"`);
        console.log(`STRAVA_REFRESH_TOKEN="${tokens.refresh_token}"`);
        console.log('-------------------------------------------\n');

        console.log('🔐 You\'ll also need to get your CLIENT_SECRET from:');
        console.log('https://www.strava.com/settings/api\n');

        console.log('After updating .env, run: npm run strava-test');

        return tokens;

    } catch (error) {
        console.error('❌ Error during authentication:', error.message);
    }
}

async function fetchAllActivities() {
    console.log('📊 Fetching all activities from Strava API...\n');

    const client = new StravaClient();

    try {
        const activities = await client.getAllActivities();

        // Save to JSON file
        const filename = `./data/strava-api-activities-${new Date().toISOString().split('T')[0]}.json`;
        await fs.writeFile(filename, JSON.stringify(activities, null, 2));

        console.log(`\n💾 Saved ${activities.length} activities to: ${filename}`);

        // Show summary
        const activityTypes = {};
        activities.forEach(activity => {
            activityTypes[activity.type] = (activityTypes[activity.type] || 0) + 1;
        });

        console.log('\n📈 Activity type breakdown:');
        Object.entries(activityTypes)
            .sort(([,a], [,b]) => b - a)
            .forEach(([type, count]) => {
                console.log(`   ${type}: ${count} activities`);
            });

        return activities;

    } catch (error) {
        console.error('❌ Error fetching activities:', error.message);
    }
}

// Command line interface
async function main() {
    const args = process.argv.slice(2);

    if (args.includes('--fetch-all')) {
        // Fetch all activities
        await fetchAllActivities();
    } else if (args.length === 1 && !args[0].startsWith('--')) {
        // Authorization code provided
        await exchangeAuthCode(args[0]);
    } else {
        // Setup/test connection
        await setupStravaAPI();
    }
}

// Run if called directly
if (require.main === module) {
    main()
        .then(() => {
            console.log('\n✨ Done!');
            process.exit(0);
        })
        .catch(error => {
            console.error('Unhandled error:', error);
            process.exit(1);
        });
}

module.exports = { setupStravaAPI, exchangeAuthCode, fetchAllActivities };