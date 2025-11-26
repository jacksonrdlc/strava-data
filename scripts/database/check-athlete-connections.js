// Script to analyze athlete and activity connections
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: './config/.env' });

// Supabase configuration
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function checkAthleteConnections() {
    console.log('🔍 Analyzing athlete and activity connections...\n');

    try {
        // Get all athletes
        console.log('👤 ATHLETES ANALYSIS:');
        const { data: athletes, error: athletesError } = await supabase
            .from('athletes')
            .select('*')
            .order('id');

        if (athletesError) {
            console.error('❌ Error reading athletes:', athletesError);
            return;
        }

        console.log(`✅ Found ${athletes.length} athletes:`);
        athletes.forEach(athlete => {
            console.log(`  • ID: ${athlete.id} - ${athlete.first_name} ${athlete.last_name} (${athlete.email})`);
        });

        // Find Jack Rudelic's correct ID
        const jackAthlete = athletes.find(a =>
            a.first_name === 'Jack' && a.last_name === 'Rudelic'
        );

        if (!jackAthlete) {
            console.error('❌ Jack Rudelic not found in athletes table!');
            return;
        }

        console.log(`\n🎯 Jack Rudelic's correct athlete ID: ${jackAthlete.id}`);

        // Check activity athlete_id distribution
        console.log('\n🏃 ACTIVITY ATHLETE_ID ANALYSIS:');
        const { data: activityCounts, error: countError } = await supabase
            .rpc('get_activity_athlete_counts');

        if (countError) {
            // If RPC doesn't exist, use a manual query
            console.log('Using manual query for activity counts...');

            // Get sample activities to see current athlete_id values
            const { data: sampleActivities, error: sampleError } = await supabase
                .from('activities')
                .select('athlete_id')
                .limit(10);

            if (sampleError) {
                console.error('❌ Error reading activities:', sampleError);
                return;
            }

            console.log('Sample activity athlete_ids:', sampleActivities.map(a => a.athlete_id));

            // Get total count per athlete_id
            const { data: activities, error: activitiesError } = await supabase
                .from('activities')
                .select('athlete_id');

            if (activitiesError) {
                console.error('❌ Error reading all activities:', activitiesError);
                return;
            }

            const athleteIdCounts = {};
            activities.forEach(activity => {
                athleteIdCounts[activity.athlete_id] = (athleteIdCounts[activity.athlete_id] || 0) + 1;
            });

            console.log('\n📊 Activities per athlete_id:');
            Object.entries(athleteIdCounts).forEach(([athleteId, count]) => {
                const isJack = athleteId == jackAthlete.id;
                const isDefault = athleteId == 1;
                console.log(`  • athlete_id ${athleteId}: ${count} activities ${isJack ? '(Jack\'s correct ID)' : ''} ${isDefault ? '(DEFAULT_ATHLETE_ID)' : ''}`);
            });
        }

        // Check if foreign key constraint exists
        console.log('\n🔗 FOREIGN KEY CONSTRAINT CHECK:');

        // Test foreign key constraint by trying to insert an activity with invalid athlete_id
        const testActivity = {
            id: 99999999998,
            athlete_id: 999999, // Invalid athlete_id
            name: 'Test Foreign Key',
            activity_date: '2024-01-01T12:00:00Z',
            start_time: '2024-01-01T12:00:00Z',
            elapsed_time: 1,
            moving_time: 1,
            distance: 1.0,
            resource_state: 2
        };

        const { error: fkTestError } = await supabase
            .from('activities')
            .insert([testActivity]);

        if (fkTestError) {
            if (fkTestError.code === '23503') {
                console.log('✅ Foreign key constraint EXISTS and is working');
                console.log(`   Error: ${fkTestError.message}`);
            } else {
                console.log('❓ Unexpected error during FK test:', fkTestError.message);
            }
        } else {
            console.log('⚠️  Foreign key constraint does NOT exist (test record inserted)');

            // Clean up test record
            await supabase
                .from('activities')
                .delete()
                .eq('id', 99999999998);
        }

        // Summary and recommendations
        console.log('\n' + '='.repeat(60));
        console.log('📋 ANALYSIS SUMMARY & RECOMMENDATIONS:');
        console.log('='.repeat(60));

        const defaultAthleteActivities = activities.filter(a => a.athlete_id === 1).length;
        const jackAthleteActivities = activities.filter(a => a.athlete_id === jackAthlete.id).length;

        if (defaultAthleteActivities > 0) {
            console.log(`⚠️  ISSUE FOUND: ${defaultAthleteActivities} activities use DEFAULT athlete_id=1`);
            console.log(`✅ CORRECT: ${jackAthleteActivities} activities use Jack's ID (${jackAthlete.id})`);
            console.log('\n🔧 RECOMMENDED FIXES:');
            console.log(`   1. Update activities: athlete_id 1 → ${jackAthlete.id}`);
            console.log(`   2. Remove default athlete record (ID=1) if it exists`);
            console.log(`   3. Verify foreign key constraints`);
        } else {
            console.log('✅ All activities correctly linked to proper athletes');
        }

    } catch (error) {
        console.error('❌ Analysis error:', error);
    }
}

// Run the analysis
if (require.main === module) {
    checkAthleteConnections()
        .then(() => {
            console.log('\n✨ Athlete connection analysis complete!');
            process.exit(0);
        })
        .catch(error => {
            console.error('Unhandled error:', error);
            process.exit(1);
        });
}

module.exports = { checkAthleteConnections };