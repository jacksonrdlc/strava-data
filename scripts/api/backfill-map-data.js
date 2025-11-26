// Backfill map data for existing activities
const StravaClient = require('./strava-client');
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: './config/.env' });

// Supabase configuration
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

// Initialize Strava client
const stravaClient = new StravaClient();

/**
 * Delay helper for rate limiting
 */
const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

/**
 * Backfill map data for all existing activities
 */
async function backfillMapData() {
    console.log('🗺️  Backfilling map data for existing activities...\n');

    try {
        // Get all activities that don't have map data yet
        // Only check Run and Walk activities (outdoor activities likely to have GPS data)
        // Filter out: Weight Training, Peloton/Tread runs, Yoga, indoor activities
        // Start with NEWEST activities first (descending order)
        console.log('📊 Fetching Run/Walk activities without map data (newest first)...');
        const { data: activitiesWithoutMaps, error: fetchError } = await supabase
            .from('activities')
            .select('id, name, activity_date, map_polyline, start_latitude')
            .is('map_polyline', null)
            .is('start_latitude', null)
            .not('name', 'ilike', '%weight training%')
            .not('name', 'ilike', '%peloton%')
            .not('name', 'ilike', '%tread%')
            .not('name', 'ilike', '%yoga%')
            .not('name', 'ilike', '%nike training%')
            .order('activity_date', { ascending: false });

        if (fetchError) {
            console.error('❌ Error fetching activities:', fetchError);
            return;
        }

        console.log(`✅ Found ${activitiesWithoutMaps.length} activities without map data\n`);

        if (activitiesWithoutMaps.length === 0) {
            console.log('✅ All activities already have map data!');
            return;
        }

        let successCount = 0;
        let errorCount = 0;
        let noMapCount = 0;

        // Process activities in batches to respect rate limits
        console.log('🔄 Fetching detailed activity data from Strava API...\n');

        for (let i = 0; i < activitiesWithoutMaps.length; i++) {
            const activity = activitiesWithoutMaps[i];
            const activityDate = new Date(activity.activity_date).toLocaleDateString();

            try {
                console.log(`   [${i + 1}/${activitiesWithoutMaps.length}] Fetching ${activity.name} (${activityDate})...`);

                // Fetch detailed activity from Strava API
                const detailedActivity = await stravaClient.getActivity(activity.id);

                // Extract map data
                const mapData = {
                    map_polyline: detailedActivity.map?.polyline || null,
                    map_summary_polyline: detailedActivity.map?.summary_polyline || null,
                    start_latitude: detailedActivity.start_latlng?.[0] || null,
                    start_longitude: detailedActivity.start_latlng?.[1] || null,
                    end_latitude: detailedActivity.end_latlng?.[0] || null,
                    end_longitude: detailedActivity.end_latlng?.[1] || null
                };

                // Check if we got any new map data
                const hasNewData = mapData.map_polyline || mapData.map_summary_polyline || mapData.start_latitude;

                if (!hasNewData) {
                    console.log(`      ⚠️  No map data available (manual/indoor activity)`);
                    noMapCount++;

                    // Mark this activity so we don't check it again
                    // Set a flag or update timestamp to indicate we've checked
                    await supabase
                        .from('activities')
                        .update({ updated_at: new Date().toISOString() })
                        .eq('id', activity.id);
                } else {
                    // Update database
                    const { error: updateError } = await supabase
                        .from('activities')
                        .update(mapData)
                        .eq('id', activity.id);

                    if (updateError) {
                        console.error(`      ❌ Error updating activity ${activity.id}:`, updateError.message);
                        errorCount++;
                    } else {
                        const hasPolyline = mapData.map_polyline ? '✓ polyline' : '';
                        const hasCoords = mapData.start_latitude ? '✓ coords' : '';
                        console.log(`      ✅ Updated [${hasPolyline} ${hasCoords}]`);
                        successCount++;
                    }
                }

                // Rate limiting: 100 requests per 15 minutes = ~400ms per request
                await delay(500);

            } catch (error) {
                console.error(`      ❌ Error processing activity ${activity.id}:`, error.message);
                errorCount++;

                // If rate limited, wait longer
                if (error.response?.status === 429) {
                    console.log('      ⏸️  Rate limited. Waiting 60 seconds...');
                    await delay(60000);
                }
            }

            // Progress update every 10 activities
            if ((i + 1) % 10 === 0) {
                console.log(`\n   📊 Progress: ${i + 1}/${activitiesWithoutMaps.length} | ✅ ${successCount} | ❌ ${errorCount} | ⚠️  ${noMapCount}\n`);
            }
        }

        // Final summary
        console.log('\n' + '='.repeat(60));
        console.log('🎉 Backfill completed!\n');
        console.log('📊 Results:');
        console.log(`   ✅ Successfully updated: ${successCount}`);
        console.log(`   ⚠️  No map data available: ${noMapCount}`);
        console.log(`   ❌ Errors: ${errorCount}`);
        console.log(`   📍 Total processed: ${activitiesWithoutMaps.length}`);
        console.log('='.repeat(60) + '\n');

        // Show rate limit status
        const rateLimitStatus = stravaClient.getRateLimitStatus();
        console.log('📊 API Rate Limit Status:');
        console.log(`   Short-term (15 min): ${rateLimitStatus.shortTerm.used}/${rateLimitStatus.shortTerm.limit}`);
        console.log(`   Long-term (daily): ${rateLimitStatus.longTerm.used}/${rateLimitStatus.longTerm.limit}`);

    } catch (error) {
        console.error('❌ Unhandled error during backfill:', error);
    }
}

// Run backfill
if (require.main === module) {
    backfillMapData()
        .then(() => {
            console.log('\n✨ Backfill script complete!');
            process.exit(0);
        })
        .catch(error => {
            console.error('Unhandled error:', error);
            process.exit(1);
        });
}

module.exports = { backfillMapData };