// Fix missing activity_type_id by fetching from Strava API
const StravaClient = require('../api/strava-client');
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: './config/.env' });

// Supabase configuration
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

// Initialize Strava client
const stravaClient = new StravaClient();

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

async function fixMissingActivityTypes() {
    console.log('🔧 Fixing missing activity_type_id values...\n');

    try {
        // Get all activities with missing activity_type_id
        console.log('📊 Fetching activities with missing activity_type_id...');
        const { data: activitiesWithoutType, error: fetchError } = await supabase
            .from('activities')
            .select('id, name, activity_date')
            .is('activity_type_id', null)
            .order('activity_date', { ascending: false });

        if (fetchError) {
            console.error('❌ Error fetching activities:', fetchError);
            return;
        }

        console.log(`✅ Found ${activitiesWithoutType.length} activities without activity_type_id\n`);

        if (activitiesWithoutType.length === 0) {
            console.log('✅ All activities have activity_type_id!');
            return;
        }

        let successCount = 0;
        let errorCount = 0;

        console.log('🔄 Fetching activity types from Strava API...\n');

        for (let i = 0; i < activitiesWithoutType.length; i++) {
            const activity = activitiesWithoutType[i];
            const activityDate = new Date(activity.activity_date).toLocaleDateString();

            try {
                console.log(`   [${i + 1}/${activitiesWithoutType.length}] ${activity.name} (${activityDate})...`);

                // Fetch detailed activity from Strava API
                const detailedActivity = await stravaClient.getActivity(activity.id);

                // Get activity type ID
                const activityTypeId = getActivityTypeId(detailedActivity.type);

                if (!activityTypeId) {
                    console.log(`      ⚠️  Unknown activity type: ${detailedActivity.type}`);
                    errorCount++;
                    continue;
                }

                // Update database
                const { error: updateError } = await supabase
                    .from('activities')
                    .update({ activity_type_id: activityTypeId })
                    .eq('id', activity.id);

                if (updateError) {
                    console.error(`      ❌ Error updating activity ${activity.id}:`, updateError.message);
                    errorCount++;
                } else {
                    console.log(`      ✅ Updated (type: ${detailedActivity.type} → ${activityTypeId})`);
                    successCount++;
                }

                // Rate limiting: 500ms between requests
                await new Promise(resolve => setTimeout(resolve, 500));

            } catch (error) {
                console.error(`      ❌ Error processing activity ${activity.id}:`, error.message);
                errorCount++;

                // If rate limited, wait longer
                if (error.response?.status === 429) {
                    console.log('      ⏸️  Rate limited. Waiting 60 seconds...');
                    await new Promise(resolve => setTimeout(resolve, 60000));
                }
            }
        }

        // Final summary
        console.log('\n' + '='.repeat(60));
        console.log('🎉 Fix completed!\n');
        console.log('📊 Results:');
        console.log(`   ✅ Successfully updated: ${successCount}`);
        console.log(`   ❌ Errors: ${errorCount}`);
        console.log(`   📍 Total processed: ${activitiesWithoutType.length}`);
        console.log('='.repeat(60) + '\n');

    } catch (error) {
        console.error('❌ Unhandled error during fix:', error);
    }
}

// Run fix
if (require.main === module) {
    fixMissingActivityTypes()
        .then(() => {
            console.log('\n✨ Fix script complete!');
            process.exit(0);
        })
        .catch(error => {
            console.error('Unhandled error:', error);
            process.exit(1);
        });
}

module.exports = { fixMissingActivityTypes };