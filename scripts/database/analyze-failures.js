// Script to analyze failed activity uploads
const fs = require('fs').promises;
const Papa = require('papaparse');
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: './config/.env' });

// Supabase configuration
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

const CSV_FILE_PATH = './data/activities.csv';
const DEFAULT_ATHLETE_ID = 1;

function parseDate(dateStr) {
    if (!dateStr) return null;
    try {
        const date = new Date(dateStr);
        return date.toISOString();
    } catch (error) {
        return null;
    }
}

function csvRowToActivity(row) {
    return {
        id: row.activity_id,
        athlete_id: DEFAULT_ATHLETE_ID,
        name: row.activity_name || 'Untitled Activity',
        description: row.activity_description || '',
        activity_date: parseDate(row.activity_date),
        start_time: parseDate(row.activity_date),
        elapsed_time: parseInt(row.elapsed_time_1) || parseInt(row.elapsed_time) || 0,
        moving_time: parseInt(row.moving_time) || 0,
        distance: parseFloat(row.distance_1) || (parseFloat(row.distance) * 1000) || 0,
        average_speed: parseFloat(row.average_speed) || 0,
        max_speed: parseFloat(row.max_speed) || 0,
        elevation_gain: parseFloat(row.elevation_gain) || 0,
        elevation_high: parseFloat(row.elevation_high) || 0,
        elevation_low: parseFloat(row.elevation_low) || 0,
        max_cadence: parseFloat(row.max_cadence) || null,
        average_cadence: parseFloat(row.average_cadence) || null,
        max_heart_rate: parseFloat(row.max_heart_rate) || null,
        average_heart_rate: parseFloat(row.average_heart_rate) || null,
        has_heartrate: !!(row.average_heart_rate || row.max_heart_rate),
        average_watts: parseFloat(row.average_watts) || null,
        max_watts: parseFloat(row.max_watts) || null,
        weighted_average_watts: parseFloat(row.weighted_average_power) || null,
        device_watts: !!row.average_watts,
        calories: parseFloat(row.calories) || null,
        average_temperature: parseFloat(row.average_temperature) || null,
        commute: row.commute === true || row.commute === 'true' || row.commute === 1,
        from_upload: row.from_upload === 1 || row.from_upload === true,
        flagged: row.flagged === 1 || row.flagged === true,
        trainer: false,
        manual: false,
        private: false,
        gear_id: row.gear || row.bike || null,
        filename: row.filename || null,
        external_id: row.filename || null,
        resource_state: 2
    };
}

async function analyzeFailures() {
    console.log('🔍 Analyzing failed activity uploads...\n');

    try {
        // Read CSV file
        const csvContent = await fs.readFile(CSV_FILE_PATH, 'utf8');
        const parseResult = Papa.parse(csvContent, {
            header: true,
            dynamicTyping: true,
            skipEmptyLines: true
        });

        console.log(`📄 Total CSV records: ${parseResult.data.length}`);

        // Get successfully imported activities
        const { data: importedActivities, error: importError } = await supabase
            .from('activities')
            .select('id');

        if (importError) {
            console.error('❌ Error getting imported activities:', importError);
            return;
        }

        const importedIds = new Set(importedActivities.map(a => a.id));
        console.log(`✅ Successfully imported: ${importedIds.size} activities`);
        console.log(`❌ Failed imports: ${parseResult.data.length - importedIds.size} activities\n`);

        // Find failed records
        const failedRecords = parseResult.data.filter(row =>
            row.activity_id && !importedIds.has(row.activity_id)
        );

        console.log('🔍 ANALYZING FAILED RECORDS:\n');

        // Analyze common failure patterns
        const failurePatterns = {
            zeroMovingTime: 0,
            zeroElapsedTime: 0,
            negativeValues: 0,
            missingDates: 0,
            invalidData: 0
        };

        const problematicRecords = [];

        failedRecords.forEach(row => {
            const activity = csvRowToActivity(row);
            const issues = [];

            // Check moving_time constraint (must be > 0)
            if (activity.moving_time <= 0) {
                failurePatterns.zeroMovingTime++;
                issues.push(`moving_time: ${activity.moving_time}`);
            }

            // Check elapsed_time constraint (must be > 0)
            if (activity.elapsed_time <= 0) {
                failurePatterns.zeroElapsedTime++;
                issues.push(`elapsed_time: ${activity.elapsed_time}`);
            }

            // Check for negative distances
            if (activity.distance < 0) {
                failurePatterns.negativeValues++;
                issues.push(`negative distance: ${activity.distance}`);
            }

            // Check for missing dates
            if (!activity.activity_date) {
                failurePatterns.missingDates++;
                issues.push('missing activity_date');
            }

            // Check heart rate constraints
            if (activity.max_heart_rate && (activity.max_heart_rate <= 0 || activity.max_heart_rate >= 300)) {
                failurePatterns.invalidData++;
                issues.push(`invalid max_heart_rate: ${activity.max_heart_rate}`);
            }

            if (activity.average_heart_rate && (activity.average_heart_rate <= 0 || activity.average_heart_rate >= 300)) {
                failurePatterns.invalidData++;
                issues.push(`invalid average_heart_rate: ${activity.average_heart_rate}`);
            }

            if (issues.length > 0) {
                problematicRecords.push({
                    id: activity.id,
                    name: activity.name,
                    date: row.activity_date,
                    issues: issues
                });
            }
        });

        // Report failure patterns
        console.log('📊 FAILURE PATTERN ANALYSIS:');
        console.log(`  • Zero/negative moving_time: ${failurePatterns.zeroMovingTime}`);
        console.log(`  • Zero/negative elapsed_time: ${failurePatterns.zeroElapsedTime}`);
        console.log(`  • Negative values: ${failurePatterns.negativeValues}`);
        console.log(`  • Missing dates: ${failurePatterns.missingDates}`);
        console.log(`  • Invalid data: ${failurePatterns.invalidData}\n`);

        // Show detailed examples of failed records
        console.log('🔍 DETAILED FAILURE EXAMPLES:');
        problematicRecords.slice(0, 10).forEach((record, index) => {
            console.log(`\n${index + 1}. Activity ID: ${record.id}`);
            console.log(`   Name: ${record.name}`);
            console.log(`   Date: ${record.date}`);
            console.log(`   Issues: ${record.issues.join(', ')}`);
        });

        if (problematicRecords.length > 10) {
            console.log(`\n... and ${problematicRecords.length - 10} more failed records`);
        }

        // Check database constraints
        console.log('\n' + '='.repeat(60));
        console.log('📋 DATABASE CONSTRAINT ANALYSIS:');

        // Get actual constraint details from database
        const { data: constraints, error: constraintError } = await supabase
            .rpc('get_table_constraints', { table_name: 'activities' });

        if (constraintError) {
            console.log('⚠️  Could not retrieve database constraints. Checking manually...');

            // Try a test insert to see what fails
            const testRecord = problematicRecords[0];
            if (testRecord) {
                console.log(`\n🧪 Testing problematic record: ${testRecord.id}`);
                const testActivity = csvRowToActivity(
                    parseResult.data.find(row => row.activity_id === testRecord.id)
                );

                const { error: testError } = await supabase
                    .from('activities')
                    .insert([testActivity]);

                if (testError) {
                    console.log(`❌ Test insert failed:`, testError.message);
                    console.log(`   Code: ${testError.code}`);
                    console.log(`   Details: ${testError.details}`);
                }
            }
        } else {
            console.log('✅ Database constraints retrieved:', constraints);
        }

    } catch (error) {
        console.error('❌ Analysis error:', error);
    }
}

// Run the analysis
if (require.main === module) {
    analyzeFailures()
        .then(() => {
            console.log('\n✨ Failure analysis complete!');
            process.exit(0);
        })
        .catch(error => {
            console.error('Unhandled error:', error);
            process.exit(1);
        });
}

module.exports = { analyzeFailures };