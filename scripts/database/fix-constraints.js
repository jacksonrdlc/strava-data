// Script to fix database constraints for stationary activities
const fs = require('fs').promises;
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: './config/.env' });

// Supabase configuration
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function fixConstraints() {
    console.log('🔧 Fixing database constraints to allow stationary activities...\n');

    try {
        // Step 1: Drop the existing constraint
        console.log('1️⃣ Dropping existing moving_time constraint...');
        const { error: dropError } = await supabase.rpc('exec_sql', {
            sql: 'ALTER TABLE activities DROP CONSTRAINT IF EXISTS activities_moving_time_check;'
        });

        if (dropError) {
            console.log('⚠️  Could not drop constraint via RPC. Trying direct SQL...');

            // Try alternative approach - direct SQL execution
            const { error: altDropError } = await supabase
                .from('activities')
                .select('id')
                .limit(1);

            if (altDropError) {
                console.error('❌ Database connection error:', altDropError);
                return;
            }

            console.log('✅ Connection verified. Manual constraint fix needed.');
            console.log('\n📋 SQL to run in Supabase SQL Editor:');
            console.log('-------------------------------------------');
            console.log('-- Drop existing constraint');
            console.log('ALTER TABLE activities DROP CONSTRAINT IF EXISTS activities_moving_time_check;');
            console.log('');
            console.log('-- Add new constraint (allows >= 0)');
            console.log('ALTER TABLE activities ADD CONSTRAINT activities_moving_time_check');
            console.log('    CHECK (moving_time >= 0);');
            console.log('');
            console.log('-- Verify constraint');
            console.log('SELECT conname, pg_get_constraintdef(oid)');
            console.log('FROM pg_constraint');
            console.log('WHERE conrelid = \'activities\'::regclass');
            console.log('    AND conname = \'activities_moving_time_check\';');
            console.log('-------------------------------------------\n');

            console.log('🔗 Go to: https://supabase.com/dashboard/project/nkxvjcdxiyjbndjvfmqy/sql/new');
            console.log('📝 Copy and paste the SQL above, then run it.\n');

            // Wait for user confirmation
            console.log('⏳ After running the SQL, you can re-run this script to verify...');
            return;
        } else {
            console.log('✅ Constraint dropped successfully');
        }

        // Step 2: Add the new constraint
        console.log('2️⃣ Adding new moving_time constraint (>= 0)...');
        const { error: addError } = await supabase.rpc('exec_sql', {
            sql: `ALTER TABLE activities ADD CONSTRAINT activities_moving_time_check
                  CHECK (moving_time >= 0);`
        });

        if (addError) {
            console.error('❌ Error adding new constraint:', addError);
            return;
        }

        console.log('✅ New constraint added successfully');

        // Step 3: Verify the constraint
        console.log('3️⃣ Verifying constraint update...');
        const { data: constraints, error: verifyError } = await supabase.rpc('exec_sql', {
            sql: `SELECT conname, pg_get_constraintdef(oid)
                  FROM pg_constraint
                  WHERE conrelid = 'activities'::regclass
                    AND conname = 'activities_moving_time_check';`
        });

        if (verifyError) {
            console.log('⚠️  Could not verify constraint automatically');
        } else {
            console.log('✅ Constraint verification:', constraints);
        }

        console.log('\n🎉 Database constraints updated successfully!');
        console.log('📝 Golf activities with zero moving time can now be imported.');

    } catch (error) {
        console.error('❌ Error updating constraints:', error);
    }
}

// Test constraint with a sample golf activity
async function testConstraintFix() {
    console.log('\n🧪 Testing constraint fix with sample golf activity...');

    const testActivity = {
        id: 99999999999, // Test ID
        athlete_id: 1,
        name: 'Test Golf Activity',
        description: 'Testing zero moving time',
        activity_date: '2024-01-01T12:00:00Z',
        start_time: '2024-01-01T12:00:00Z',
        elapsed_time: 3600,
        moving_time: 0, // This should now be allowed
        distance: 10.0,
        average_speed: 0.0,
        max_speed: 0.0,
        elevation_gain: 0.0,
        elevation_high: 0.0,
        elevation_low: 0.0,
        has_heartrate: false,
        commute: false,
        from_upload: true,
        flagged: false,
        trainer: false,
        manual: false,
        private: false,
        filename: 'test.gpx',
        external_id: 'test',
        resource_state: 2
    };

    const { data, error } = await supabase
        .from('activities')
        .upsert([testActivity]);

    if (error) {
        console.error('❌ Test failed:', error.message);
        return false;
    } else {
        console.log('✅ Test passed! Zero moving time is now allowed.');

        // Clean up test record
        await supabase
            .from('activities')
            .delete()
            .eq('id', 99999999999);

        return true;
    }
}

// Run the constraint fix
if (require.main === module) {
    fixConstraints()
        .then(async () => {
            // Test the fix
            const testPassed = await testConstraintFix();

            if (testPassed) {
                console.log('\n✨ Ready to re-import failed activities!');
                console.log('🚀 Run: npm run import');
            }

            process.exit(0);
        })
        .catch(error => {
            console.error('Unhandled error:', error);
            process.exit(1);
        });
}

module.exports = { fixConstraints, testConstraintFix };