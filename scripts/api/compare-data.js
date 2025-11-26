// Compare Strava API data with CSV/Database data
const fs = require('fs').promises;
const { createClient } = require('@supabase/supabase-js');
const StravaClient = require('./strava-client');
require('dotenv').config({ path: './config/.env' });

// Supabase configuration
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

// Initialize Strava client
const stravaClient = new StravaClient();

async function compareData() {
    console.log('🔍 Comparing Strava API data with Database/CSV data...\n');

    try {
        // Fetch fresh data from Strava API
        console.log('📊 Fetching fresh data from Strava API...');
        const apiActivities = await stravaClient.getAllActivities();
        console.log(`✅ Loaded ${apiActivities.length} activities from API`);

        // Load database data
        console.log('🗄️ Loading database data...');
        const { data: dbActivities, error: dbError } = await supabase
            .from('activities')
            .select('id, name, activity_date, distance, elapsed_time, moving_time');

        if (dbError) {
            console.error('❌ Error loading database data:', dbError);
            return;
        }
        console.log(`✅ Loaded ${dbActivities.length} activities from database`);

        // Create lookup maps
        const apiMap = new Map(apiActivities.map(a => [a.id.toString(), a]));
        const dbMap = new Map(dbActivities.map(a => [a.id.toString(), a]));

        // Analysis
        console.log('\n' + '='.repeat(60));
        console.log('📈 DATA COMPARISON ANALYSIS');
        console.log('='.repeat(60));

        // Count comparison
        console.log(`\n1️⃣ COUNT COMPARISON:`);
        console.log(`   📊 API Activities: ${apiActivities.length}`);
        console.log(`   🗄️ Database Activities: ${dbActivities.length}`);
        console.log(`   📈 Difference: ${apiActivities.length - dbActivities.length}`);

        // Find activities only in API (newer activities)
        const onlyInApi = apiActivities.filter(a => !dbMap.has(a.id.toString()));
        console.log(`\n2️⃣ NEW ACTIVITIES (API only): ${onlyInApi.length}`);
        if (onlyInApi.length > 0) {
            console.log('   🆕 Recent activities not in database:');
            onlyInApi.slice(0, 5).forEach(activity => {
                const date = new Date(activity.start_date).toLocaleDateString();
                const distance = activity.distance ? (activity.distance / 1000).toFixed(2) + 'km' : 'N/A';
                console.log(`      • ${activity.name} - ${distance} (${date})`);
            });
            if (onlyInApi.length > 5) {
                console.log(`      ... and ${onlyInApi.length - 5} more`);
            }
        }

        // Find activities only in database (shouldn't happen normally)
        const onlyInDb = dbActivities.filter(a => !apiMap.has(a.id.toString()));
        console.log(`\n3️⃣ DATABASE-ONLY ACTIVITIES: ${onlyInDb.length}`);
        if (onlyInDb.length > 0) {
            console.log('   ⚠️ Activities in database but not in API:');
            onlyInDb.slice(0, 5).forEach(activity => {
                const date = new Date(activity.activity_date).toLocaleDateString();
                console.log(`      • ${activity.name} - ID: ${activity.id} (${date})`);
            });
        }

        // Activity type comparison
        console.log(`\n4️⃣ ACTIVITY TYPE COMPARISON:`);

        // API activity types
        const apiTypes = {};
        apiActivities.forEach(a => {
            apiTypes[a.type] = (apiTypes[a.type] || 0) + 1;
        });

        // Sample database activities to determine types (since we don't store type directly)
        const dbSample = dbActivities.slice(0, 100);
        const dbTypeGuess = {};
        dbSample.forEach(a => {
            let type = 'Unknown';
            if (a.name.toLowerCase().includes('run')) type = 'Run';
            else if (a.name.toLowerCase().includes('weight')) type = 'WeightTraining';
            else if (a.name.toLowerCase().includes('walk')) type = 'Walk';
            else if (a.name.toLowerCase().includes('golf')) type = 'Golf';
            else if (a.name.toLowerCase().includes('yoga')) type = 'Yoga';
            dbTypeGuess[type] = (dbTypeGuess[type] || 0) + 1;
        });

        console.log('   📊 API Types:');
        Object.entries(apiTypes)
            .sort(([,a], [,b]) => b - a)
            .forEach(([type, count]) => {
                console.log(`      ${type}: ${count}`);
            });

        // Date range comparison
        console.log(`\n5️⃣ DATE RANGE COMPARISON:`);

        const apiDates = apiActivities.map(a => new Date(a.start_date)).sort();
        const dbDates = dbActivities.map(a => new Date(a.activity_date)).sort();

        console.log(`   📊 API Date Range: ${apiDates[0].toLocaleDateString()} → ${apiDates[apiDates.length - 1].toLocaleDateString()}`);
        console.log(`   🗄️ DB Date Range: ${dbDates[0].toLocaleDateString()} → ${dbDates[dbDates.length - 1].toLocaleDateString()}`);

        // Data quality comparison for matching activities
        console.log(`\n6️⃣ DATA QUALITY COMPARISON (Sample):`);
        const commonActivities = apiActivities.filter(a => dbMap.has(a.id.toString())).slice(0, 3);

        commonActivities.forEach(apiActivity => {
            const dbActivity = dbMap.get(apiActivity.id.toString());
            console.log(`\n   Activity: ${apiActivity.name}`);
            console.log(`      🆔 ID: ${apiActivity.id}`);
            console.log(`      📏 Distance - API: ${(apiActivity.distance / 1000).toFixed(2)}km, DB: ${(dbActivity.distance / 1000).toFixed(2)}km`);
            console.log(`      ⏱️ Time - API: ${apiActivity.elapsed_time}s, DB: ${dbActivity.elapsed_time}s`);
            console.log(`      🏃 Moving - API: ${apiActivity.moving_time}s, DB: ${dbActivity.moving_time}s`);
        });

        // Recommendations
        console.log('\n' + '='.repeat(60));
        console.log('💡 RECOMMENDATIONS:');
        console.log('='.repeat(60));

        if (onlyInApi.length > 0) {
            console.log(`\n✅ SYNC NEEDED: ${onlyInApi.length} new activities available from API`);
            console.log('   🔄 Run sync script to import latest activities');
        } else {
            console.log('\n✅ DATA IN SYNC: Database is up to date with API');
        }

        if (onlyInDb.length > 0) {
            console.log(`\n⚠️ INVESTIGATE: ${onlyInDb.length} activities in database but not in API`);
            console.log('   🔍 These might be deleted activities or data discrepancies');
        }

        console.log('\n📊 API provides richer data including:');
        console.log('   • Real-time activity updates');
        console.log('   • Enhanced metadata (kudos, comments, etc.)');
        console.log('   • Segment information');
        console.log('   • Photos and maps');

        // Generate sync plan if needed
        if (onlyInApi.length > 0) {
            console.log('\n🚀 SYNC PLAN:');
            console.log(`   1. Import ${onlyInApi.length} new activities from API`);
            console.log(`   2. Update database with latest activity data`);
            console.log(`   3. Set up automated sync for future activities`);

            // Save new activities for potential import
            const syncFile = './data/activities-to-sync.json';
            await fs.writeFile(syncFile, JSON.stringify(onlyInApi, null, 2));
            console.log(`   💾 Saved new activities to: ${syncFile}`);
        }

    } catch (error) {
        console.error('❌ Error during comparison:', error);
    }
}

// Run comparison
if (require.main === module) {
    compareData()
        .then(() => {
            console.log('\n✨ Comparison complete!');
            process.exit(0);
        })
        .catch(error => {
            console.error('Unhandled error:', error);
            process.exit(1);
        });
}

module.exports = { compareData };