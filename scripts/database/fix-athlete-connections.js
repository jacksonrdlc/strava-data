// Script to fix athlete connections and foreign key constraints
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: './config/.env' });

// Supabase configuration
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function fixAthleteConnections() {
    console.log('🔧 Fixing athlete connections and foreign key constraints...\n');

    try {
        // Step 1: Get Jack's correct athlete ID
        const { data: athletes, error: athletesError } = await supabase
            .from('athletes')
            .select('*')
            .eq('first_name', 'Jack')
            .eq('last_name', 'Rudelic');

        if (athletesError || !athletes.length) {
            console.error('❌ Could not find Jack Rudelic in athletes table');
            return;
        }

        const jackId = athletes[0].id;
        console.log(`✅ Found Jack Rudelic - ID: ${jackId}`);

        // Step 2: Check current activity distribution
        const { data: activities, error: activitiesError } = await supabase
            .from('activities')
            .select('athlete_id');

        if (activitiesError) {
            console.error('❌ Error reading activities:', activitiesError);
            return;
        }

        const activitiesWithWrongId = activities.filter(a => a.athlete_id === 1).length;
        const activitiesWithCorrectId = activities.filter(a => a.athlete_id === jackId).length;

        console.log(`📊 Current state:`);
        console.log(`   • Activities with wrong ID (1): ${activitiesWithWrongId}`);
        console.log(`   • Activities with correct ID (${jackId}): ${activitiesWithCorrectId}`);

        if (activitiesWithWrongId === 0) {
            console.log('✅ All activities already have correct athlete_id!');
        } else {
            // Step 3: Update activities to use Jack's correct ID
            console.log(`\n🔄 Updating ${activitiesWithWrongId} activities...`);

            const { error: updateError } = await supabase
                .from('activities')
                .update({ athlete_id: jackId })
                .eq('athlete_id', 1);

            if (updateError) {
                console.error('❌ Error updating activities:', updateError);
                return;
            }

            console.log(`✅ Updated ${activitiesWithWrongId} activities to use athlete_id ${jackId}`);
        }

        // Step 4: Remove dummy athlete record (ID=1)
        console.log('\n🗑️  Removing dummy athlete record...');

        const { error: deleteError } = await supabase
            .from('athletes')
            .delete()
            .eq('id', 1);

        if (deleteError) {
            console.log('⚠️  Could not delete dummy athlete (may not exist):', deleteError.message);
        } else {
            console.log('✅ Removed dummy athlete record (ID=1)');
        }

        // Step 5: Verify foreign key constraint exists
        console.log('\n🔗 Checking foreign key constraint...');

        // Generate SQL for manual execution since we can't create constraints via JS client
        console.log('\n📋 SQL to run in Supabase SQL Editor:');
        console.log('-------------------------------------------');
        console.log('-- Ensure foreign key constraint exists');
        console.log('ALTER TABLE activities DROP CONSTRAINT IF EXISTS activities_athlete_id_fkey;');
        console.log('ALTER TABLE activities ADD CONSTRAINT activities_athlete_id_fkey');
        console.log('    FOREIGN KEY (athlete_id) REFERENCES athletes(id) ON DELETE CASCADE;');
        console.log('');
        console.log('-- Verify constraint');
        console.log('SELECT conname, pg_get_constraintdef(oid)');
        console.log('FROM pg_constraint');
        console.log('WHERE conrelid = \'activities\'::regclass');
        console.log('    AND conname = \'activities_athlete_id_fkey\';');
        console.log('-------------------------------------------\n');

        // Step 6: Test foreign key constraint
        console.log('🧪 Testing foreign key constraint...');

        const testActivity = {
            id: 99999999997,
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

        if (fkTestError && fkTestError.code === '23503') {
            console.log('✅ Foreign key constraint is working!');
        } else if (!fkTestError) {
            console.log('⚠️  Foreign key constraint NOT enforced - please run the SQL above');
            // Clean up test record
            await supabase.from('activities').delete().eq('id', 99999999997);
        } else {
            console.log('❓ Unexpected error during FK test:', fkTestError.message);
        }

        // Step 7: Final verification
        console.log('\n🔍 Final verification...');

        const { data: finalActivities, error: finalError } = await supabase
            .from('activities')
            .select('athlete_id');

        if (finalError) {
            console.error('❌ Error in final verification:', finalError);
            return;
        }

        const finalCounts = {};
        finalActivities.forEach(activity => {
            finalCounts[activity.athlete_id] = (finalCounts[activity.athlete_id] || 0) + 1;
        });

        console.log('📊 Final activity distribution:');
        Object.entries(finalCounts).forEach(([athleteId, count]) => {
            const isJack = athleteId == jackId;
            console.log(`   • athlete_id ${athleteId}: ${count} activities ${isJack ? '✅ (Jack)' : ''}`);
        });

        console.log('\n🎉 Athlete connection fixes completed!');

    } catch (error) {
        console.error('❌ Error fixing athlete connections:', error);
    }
}

// Run the fix
if (require.main === module) {
    fixAthleteConnections()
        .then(() => {
            console.log('\n✨ Fix complete!');
            process.exit(0);
        })
        .catch(error => {
            console.error('Unhandled error:', error);
            process.exit(1);
        });
}

module.exports = { fixAthleteConnections };