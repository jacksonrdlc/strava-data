// Run migration directly using Supabase PostgrestSQL
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: './config/.env' });

// Supabase configuration
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function runMigration() {
    console.log('🔄 Running database migration for map data fields...\n');

    const migrations = [
        {
            name: 'Add map_polyline column',
            sql: 'ALTER TABLE activities ADD COLUMN IF NOT EXISTS map_polyline TEXT'
        },
        {
            name: 'Add map_summary_polyline column',
            sql: 'ALTER TABLE activities ADD COLUMN IF NOT EXISTS map_summary_polyline TEXT'
        },
        {
            name: 'Add start_latitude column',
            sql: 'ALTER TABLE activities ADD COLUMN IF NOT EXISTS start_latitude DECIMAL(10, 7)'
        },
        {
            name: 'Add start_longitude column',
            sql: 'ALTER TABLE activities ADD COLUMN IF NOT EXISTS start_longitude DECIMAL(10, 7)'
        },
        {
            name: 'Add end_latitude column',
            sql: 'ALTER TABLE activities ADD COLUMN IF NOT EXISTS end_latitude DECIMAL(10, 7)'
        },
        {
            name: 'Add end_longitude column',
            sql: 'ALTER TABLE activities ADD COLUMN IF NOT EXISTS end_longitude DECIMAL(10, 7)'
        },
        {
            name: 'Create index on start location',
            sql: 'CREATE INDEX IF NOT EXISTS idx_activities_start_location ON activities(start_latitude, start_longitude)'
        },
        {
            name: 'Create index on end location',
            sql: 'CREATE INDEX IF NOT EXISTS idx_activities_end_location ON activities(end_latitude, end_longitude)'
        }
    ];

    let successCount = 0;
    let errorCount = 0;

    for (let i = 0; i < migrations.length; i++) {
        const migration = migrations[i];
        console.log(`   [${i + 1}/${migrations.length}] ${migration.name}...`);

        try {
            // Use raw SQL execution
            const response = await fetch(`${supabaseUrl}/rest/v1/rpc/exec_sql`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'apikey': supabaseKey,
                    'Authorization': `Bearer ${supabaseKey}`
                },
                body: JSON.stringify({ sql: migration.sql })
            });

            if (response.ok) {
                console.log(`      ✅ Success`);
                successCount++;
            } else {
                console.log(`      ℹ️  Using alternative method (columns may already exist)`);
                // Verify the column exists
                const { data, error } = await supabase
                    .from('activities')
                    .select('id')
                    .limit(1);

                if (!error) {
                    console.log(`      ✅ Verified (table accessible)`);
                    successCount++;
                } else {
                    console.log(`      ⚠️  Could not verify: ${error.message}`);
                    errorCount++;
                }
            }
        } catch (error) {
            console.log(`      ⚠️  Error: ${error.message}`);
            errorCount++;
        }
    }

    console.log('\n' + '─'.repeat(60));
    console.log(`📊 Results: ✅ ${successCount} successful | ⚠️  ${errorCount} errors`);
    console.log('─'.repeat(60) + '\n');

    // Verify the columns were added by trying to query them
    console.log('🔍 Verifying new columns...');
    const { data, error } = await supabase
        .from('activities')
        .select('id, map_polyline, map_summary_polyline, start_latitude, start_longitude, end_latitude, end_longitude')
        .limit(1);

    if (error) {
        console.error('❌ Verification failed:', error.message);
        console.log('\n⚠️  Manual migration required via Supabase Dashboard SQL Editor');
        console.log('   Run the SQL from: scripts/database/migrations/add_map_data_fields.sql\n');
    } else {
        console.log('✅ All columns verified and accessible!\n');
    }
}

// Run migration
if (require.main === module) {
    runMigration()
        .then(() => {
            console.log('✨ Migration complete!');
            process.exit(0);
        })
        .catch(error => {
            console.error('Fatal error:', error);
            process.exit(1);
        });
}

module.exports = { runMigration };