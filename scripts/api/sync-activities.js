// Sync new activities from Strava API to database
const fs = require('fs').promises;
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: './config/.env' });

// Supabase configuration
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

/**
 * Map Strava activity type to database activity_type_id
 */
function getActivityTypeId(stravaType) {
    const typeMap = {
        'Run': 103,
        'Ride': 104,
        'Walk': 105,
        'Hike': 106,
        'VirtualRide': 107,
        'VirtualRun': 108,
        'Swim': 109,
        'Workout': 110,
        'WeightTraining': 111,
        'Yoga': 112,
        'Crossfit': 113,
        'Elliptical': 114,
        'Rowing': 115,
        'RockClimbing': 116,
        'AlpineSki': 117,
        'Snowboard': 118,
        'MountainBikeRide': 119,
        'GravelRide': 120,
        'TrailRun': 121,
        'Golf': 123
    };
    return typeMap[stravaType] || null;
}

/**
 * Transform Strava API activity to database format
 */
function transformApiActivity(apiActivity) {
    // Get Jack's athlete ID (we know it's 94451852 from previous analysis)
    const JACK_ATHLETE_ID = 94451852;

    return {
        id: apiActivity.id,
        athlete_id: JACK_ATHLETE_ID,
        activity_type_id: getActivityTypeId(apiActivity.type),
        name: apiActivity.name || 'Untitled Activity',
        description: apiActivity.description || '',

        // Dates
        activity_date: apiActivity.start_date,
        start_time: apiActivity.start_date_local || apiActivity.start_date,

        // Times (API provides in seconds) - ensure integers
        elapsed_time: parseInt(apiActivity.elapsed_time) || 0,
        moving_time: parseInt(apiActivity.moving_time) || 0,

        // Distance (API provides in meters) - ensure float
        distance: parseFloat(apiActivity.distance) || 0,

        // Speed metrics (API provides in m/s) - ensure float
        average_speed: parseFloat(apiActivity.average_speed) || 0,
        max_speed: parseFloat(apiActivity.max_speed) || 0,

        // Elevation (API provides in meters) - ensure float
        elevation_gain: parseFloat(apiActivity.total_elevation_gain) || 0,
        elevation_high: apiActivity.elev_high ? parseFloat(apiActivity.elev_high) : null,
        elevation_low: apiActivity.elev_low ? parseFloat(apiActivity.elev_low) : null,

        // Cadence - ensure integers or null
        max_cadence: apiActivity.max_cadence ? parseInt(apiActivity.max_cadence) : null,
        average_cadence: apiActivity.average_cadence ? parseInt(apiActivity.average_cadence) : null,

        // Heart rate - ensure integers or null
        max_heart_rate: apiActivity.max_heartrate ? parseInt(apiActivity.max_heartrate) : null,
        average_heart_rate: apiActivity.average_heartrate ? parseInt(apiActivity.average_heartrate) : null,
        has_heartrate: Boolean(apiActivity.has_heartrate),

        // Power - ensure integers or null
        average_watts: apiActivity.average_watts ? parseInt(apiActivity.average_watts) : null,
        max_watts: apiActivity.max_watts ? parseInt(apiActivity.max_watts) : null,
        weighted_average_watts: apiActivity.weighted_average_watts ? parseInt(apiActivity.weighted_average_watts) : null,
        device_watts: Boolean(apiActivity.device_watts),

        // Other metrics
        calories: apiActivity.calories ? parseInt(apiActivity.calories) : null,
        average_temperature: apiActivity.average_temp ? parseInt(apiActivity.average_temp) : null,

        // Map data (encoded polylines)
        map_polyline: apiActivity.map?.polyline || null,
        map_summary_polyline: apiActivity.map?.summary_polyline || null,

        // Location data (start/end coordinates)
        start_latitude: apiActivity.start_latlng?.[0] || null,
        start_longitude: apiActivity.start_latlng?.[1] || null,
        end_latitude: apiActivity.end_latlng?.[0] || null,
        end_longitude: apiActivity.end_latlng?.[1] || null,

        // Flags
        commute: apiActivity.commute || false,
        from_upload: apiActivity.upload_id ? true : false,
        flagged: apiActivity.flagged || false,
        trainer: apiActivity.trainer || false,
        manual: apiActivity.manual || false,
        private: apiActivity.private || false,

        // Gear
        gear_id: apiActivity.gear_id || null,

        // File reference
        filename: null, // API doesn't provide original filename
        external_id: apiActivity.external_id || null,
        resource_state: apiActivity.resource_state || 2
    };
}

async function syncNewActivities() {
    console.log('🔄 Syncing new activities from Strava API to database...\n');

    try {
        // Check if sync file exists
        const syncFile = './data/activities-to-sync.json';

        try {
            await fs.access(syncFile);
        } catch (error) {
            console.log('❌ No activities-to-sync.json file found.');
            console.log('🔄 Run "npm run strava-compare" first to identify new activities.');
            return;
        }

        // Load activities to sync
        console.log('📂 Loading activities to sync...');
        const syncContent = await fs.readFile(syncFile, 'utf8');
        const activitiesToSync = JSON.parse(syncContent);

        console.log(`✅ Found ${activitiesToSync.length} activities to sync`);

        if (activitiesToSync.length === 0) {
            console.log('✅ No new activities to sync!');
            return;
        }

        // Get Jack's athlete ID from database
        console.log('👤 Verifying athlete...');
        const { data: jack, error: jackError } = await supabase
            .from('athletes')
            .select('id')
            .eq('first_name', 'Jack')
            .eq('last_name', 'Rudelic')
            .single();

        if (jackError) {
            console.error('❌ Error finding Jack Rudelic:', jackError);
            return;
        }

        console.log(`✅ Jack Rudelic athlete_id: ${jack.id}`);

        // Transform API activities to database format
        console.log('\n📝 Transforming API activities to database format...');
        const transformedActivities = activitiesToSync.map(apiActivity => {
            try {
                const transformed = transformApiActivity(apiActivity);
                // Override with correct athlete ID from database
                transformed.athlete_id = jack.id;
                return transformed;
            } catch (error) {
                console.error(`❌ Error transforming activity ${apiActivity.id}:`, error);
                return null;
            }
        }).filter(activity => activity !== null);

        console.log(`✅ Transformed ${transformedActivities.length} activities`);

        // Show preview of activities to be imported
        console.log('\n🔍 Preview of activities to import:');
        transformedActivities.forEach((activity, index) => {
            const date = new Date(activity.activity_date).toLocaleDateString();
            const distance = activity.distance ? (activity.distance / 1000).toFixed(2) + 'km' : 'N/A';
            console.log(`   ${index + 1}. ${activity.name} - ${distance} (${date})`);
        });

        // Import activities to database
        console.log('\n💾 Importing activities to database...');

        const { data: insertedActivities, error: insertError } = await supabase
            .from('activities')
            .upsert(transformedActivities, {
                onConflict: 'id',
                ignoreDuplicates: false
            })
            .select('id, name');

        if (insertError) {
            console.error('❌ Error importing activities:', insertError);
            return;
        }

        console.log(`✅ Successfully imported ${transformedActivities.length} activities!`);

        // Verify the import
        console.log('\n🔍 Verifying import...');
        const activityIds = transformedActivities.map(a => a.id);

        const { data: verifyActivities, error: verifyError } = await supabase
            .from('activities')
            .select('id, name, activity_date, distance, athlete_id')
            .in('id', activityIds);

        if (verifyError) {
            console.error('❌ Error verifying import:', verifyError);
            return;
        }

        console.log('✅ Verification successful:');
        verifyActivities.forEach(activity => {
            const date = new Date(activity.activity_date).toLocaleDateString();
            const distance = activity.distance ? (activity.distance / 1000).toFixed(2) + 'km' : 'N/A';
            console.log(`   ✓ ${activity.name} - ${distance} (${date}) [athlete_id: ${activity.athlete_id}]`);
        });

        // Get updated totals
        console.log('\n📊 Updated database totals:');
        const { count: totalActivities, error: countError } = await supabase
            .from('activities')
            .select('*', { count: 'exact', head: true });

        if (!countError) {
            console.log(`   Total activities in database: ${totalActivities}`);
        }

        // Clean up sync file
        console.log('\n🧹 Cleaning up...');
        await fs.unlink(syncFile);
        console.log('✅ Removed activities-to-sync.json file');

        console.log('\n🎉 Sync completed successfully!');
        console.log('💡 Your database is now up to date with the latest Strava activities.');

    } catch (error) {
        console.error('❌ Error during sync:', error);
    }
}

// Run sync
if (require.main === module) {
    syncNewActivities()
        .then(() => {
            console.log('\n✨ Sync complete!');
            process.exit(0);
        })
        .catch(error => {
            console.error('Unhandled error:', error);
            process.exit(1);
        });
}

module.exports = { syncNewActivities, transformApiActivity };