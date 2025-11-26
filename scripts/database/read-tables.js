// Database reader script for Supabase
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: './config/.env' });

// Supabase configuration
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function readTables() {
    console.log('🔍 Connecting to Supabase and reading tables...\n');

    try {
        // Check athletes table
        console.log('👤 ATHLETES TABLE:');
        const { data: athletes, error: athletesError } = await supabase
            .from('athletes')
            .select('*')
            .limit(5);

        if (athletesError) {
            console.error('❌ Error reading athletes:', athletesError);
        } else {
            console.log(`✅ Found ${athletes.length} athletes`);
            console.log(athletes);
        }

        console.log('\n' + '='.repeat(50) + '\n');

        // Check activities table with summary stats
        console.log('🏃 ACTIVITIES TABLE SUMMARY:');
        const { count, error: countError } = await supabase
            .from('activities')
            .select('*', { count: 'exact', head: true });

        if (countError) {
            console.error('❌ Error counting activities:', countError);
        } else {
            console.log(`✅ Total activities: ${count || 'Unknown'}`);
        }

        // Get sample activities
        const { data: activities, error: activitiesError } = await supabase
            .from('activities')
            .select('id, name, activity_date, distance, elapsed_time, average_speed')
            .order('activity_date', { ascending: false })
            .limit(5);

        if (activitiesError) {
            console.error('❌ Error reading activities:', activitiesError);
        } else {
            console.log(`📊 Latest ${activities.length} activities:`);
            activities.forEach(activity => {
                console.log(`  • ${activity.name} (${activity.activity_date}) - ${(activity.distance/1000).toFixed(2)}km`);
            });
        }

        console.log('\n' + '='.repeat(50) + '\n');

        // Check gear table
        console.log('🚲 GEAR TABLE:');
        const { data: gear, error: gearError } = await supabase
            .from('gear')
            .select('*')
            .limit(10);

        if (gearError) {
            console.error('❌ Error reading gear:', gearError);
        } else {
            console.log(`✅ Found ${gear.length} gear items`);
            gear.forEach(item => {
                console.log(`  • ${item.name} (${item.gear_type})`);
            });
        }

        console.log('\n' + '='.repeat(50) + '\n');

        // Activity type statistics
        console.log('📈 ACTIVITY TYPE STATISTICS:');
        const { data: typeStats, error: typeError } = await supabase
            .rpc('get_activity_type_stats');

        if (typeError) {
            // If RPC doesn't exist, try a simple query
            const { data: simpleStats, error: simpleError } = await supabase
                .from('activities')
                .select('name')
                .limit(10);

            if (simpleError) {
                console.error('❌ Error reading activity types:', simpleError);
            } else {
                console.log('📝 Sample activity names:');
                simpleStats.forEach(activity => {
                    console.log(`  • ${activity.name}`);
                });
            }
        } else {
            console.log('📊 Activity type breakdown:', typeStats);
        }

    } catch (error) {
        console.error('❌ Connection error:', error);
    }
}

// Run the reader
if (require.main === module) {
    readTables()
        .then(() => {
            console.log('\n✨ Database read complete!');
            process.exit(0);
        })
        .catch(error => {
            console.error('Unhandled error:', error);
            process.exit(1);
        });
}

module.exports = { readTables };