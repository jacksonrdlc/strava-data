// strava-csv-import.js
// Node.js script to import Strava activities from CSV to Supabase

const fs = require('fs').promises;
const path = require('path');
const Papa = require('papaparse');
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: './config/.env' });

// Supabase configuration
const supabaseUrl = process.env.SUPABASE_URL || 'YOUR_SUPABASE_URL';
const supabaseKey = process.env.SUPABASE_SERVICE_KEY || 'YOUR_SUPABASE_SERVICE_KEY';
const supabase = createClient(supabaseUrl, supabaseKey);

// Configuration
const CSV_FILE_PATH = './data/activities.csv';
const BATCH_SIZE = 50; // Insert records in batches
const DEFAULT_ATHLETE_ID = 1; // You may need to adjust this based on your athlete ID

/**
 * Parse date string to ISO format
 */
function parseDate(dateStr) {
    if (!dateStr) return null;
    try {
        // Handle format like "Jun 30, 2023, 9:26:21 PM"
        const date = new Date(dateStr);
        return date.toISOString();
    } catch (error) {
        console.error(`Error parsing date: ${dateStr}`, error);
        return null;
    }
}

/**
 * Convert CSV row to activity record
 */
function csvRowToActivity(row) {
    return {
        id: row.activity_id,
        athlete_id: DEFAULT_ATHLETE_ID,
        name: row.activity_name || 'Untitled Activity',
        description: row.activity_description || '',

        // Dates - using database schema field names
        activity_date: parseDate(row.activity_date),
        start_time: parseDate(row.activity_date),

        // Times
        elapsed_time: parseInt(row.elapsed_time_1) || parseInt(row.elapsed_time) || 0,
        moving_time: parseInt(row.moving_time) || 0,

        // Distances (converting to meters if needed)
        distance: parseFloat(row.distance_1) || (parseFloat(row.distance) * 1000) || 0,

        // Speed metrics
        average_speed: parseFloat(row.average_speed) || 0,
        max_speed: parseFloat(row.max_speed) || 0,

        // Elevation - using database schema field names
        elevation_gain: parseFloat(row.elevation_gain) || 0,
        elevation_high: parseFloat(row.elevation_high) || 0,
        elevation_low: parseFloat(row.elevation_low) || 0,

        // Cadence
        max_cadence: parseFloat(row.max_cadence) || null,
        average_cadence: parseFloat(row.average_cadence) || null,

        // Heart rate
        max_heart_rate: parseFloat(row.max_heart_rate) || null,
        average_heart_rate: parseFloat(row.average_heart_rate) || null,
        has_heartrate: !!(row.average_heart_rate || row.max_heart_rate),

        // Power
        average_watts: parseFloat(row.average_watts) || null,
        max_watts: parseFloat(row.max_watts) || null,
        weighted_average_watts: parseFloat(row.weighted_average_power) || null,
        device_watts: !!row.average_watts,

        // Other metrics
        calories: parseFloat(row.calories) || null,
        average_temperature: parseFloat(row.average_temperature) || null,

        // Flags
        commute: row.commute === true || row.commute === 'true' || row.commute === 1,
        from_upload: row.from_upload === 1 || row.from_upload === true,
        flagged: row.flagged === 1 || row.flagged === true,
        trainer: false,
        manual: false,
        private: false,

        // Gear
        gear_id: row.gear || row.bike || null,

        // File reference
        filename: row.filename || null,
        external_id: row.filename || null,
        resource_state: 2
    };
}

/**
 * Insert or update athlete if needed
 */
async function ensureAthlete(athleteId) {
    try {
        const { data, error } = await supabase
            .from('athletes')
            .upsert({
                id: athleteId,
                first_name: 'Strava',
                last_name: 'User'
            }, {
                onConflict: 'id'
            });

        if (error && error.code !== '23505') { // Ignore unique constraint violations
            console.error('Error upserting athlete:', error);
        }
    } catch (error) {
        console.error('Error ensuring athlete:', error);
    }
}

/**
 * Insert gear if it exists
 */
async function insertGear(gearSet) {
    const gearArray = Array.from(gearSet).filter(id => id && id !== 'null');

    if (gearArray.length === 0) return;

    try {
        const gearRecords = gearArray.map(id => ({
            id: id,
            athlete_id: DEFAULT_ATHLETE_ID,
            gear_type: 'other', // Default to 'other' since we don't know the type
            name: `Gear ${id}`,
            is_primary: false
        }));

        const { error } = await supabase
            .from('gear')
            .upsert(gearRecords, {
                onConflict: 'id',
                ignoreDuplicates: true
            });

        if (error && error.code !== '23505') {
            console.error('Error inserting gear:', error);
        }
    } catch (error) {
        console.error('Error with gear insertion:', error);
    }
}

/**
 * Insert activities in batches
 */
async function insertActivities(activities) {
    const results = {
        success: 0,
        failed: 0,
        errors: []
    };

    // Process in batches
    for (let i = 0; i < activities.length; i += BATCH_SIZE) {
        const batch = activities.slice(i, i + BATCH_SIZE);

        try {
            const { data, error } = await supabase
                .from('activities')
                .upsert(batch, {
                    onConflict: 'id',
                    ignoreDuplicates: false
                });

            if (error) {
                console.error(`Error in batch ${i / BATCH_SIZE + 1}:`, error);
                results.failed += batch.length;
                results.errors.push(error);
            } else {
                results.success += batch.length;
                console.log(`✓ Inserted batch ${i / BATCH_SIZE + 1} (${batch.length} records)`);
            }
        } catch (error) {
            console.error(`Error processing batch ${i / BATCH_SIZE + 1}:`, error);
            results.failed += batch.length;
            results.errors.push(error);
        }

        // Add a small delay between batches to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 100));
    }

    return results;
}

/**
 * Main import function
 */
async function importActivities() {
    console.log('🚀 Starting Strava CSV import to Supabase...\n');

    try {
        // Read CSV file
        console.log(`📄 Reading CSV file: ${CSV_FILE_PATH}`);
        const csvContent = await fs.readFile(CSV_FILE_PATH, 'utf8');

        // Parse CSV
        console.log('📊 Parsing CSV data...');
        const parseResult = Papa.parse(csvContent, {
            header: true,
            dynamicTyping: true,
            skipEmptyLines: true
        });

        if (parseResult.errors.length > 0) {
            console.warn('⚠️  CSV parsing warnings:', parseResult.errors);
        }

        console.log(`✓ Found ${parseResult.data.length} activities\n`);

        // Ensure athlete exists
        console.log('👤 Setting up athlete...');
        await ensureAthlete(DEFAULT_ATHLETE_ID);

        // Extract unique gear IDs
        console.log('🚲 Processing gear...');
        const gearSet = new Set();
        parseResult.data.forEach(row => {
            if (row.gear) gearSet.add(row.gear);
            if (row.bike) gearSet.add(row.bike);
            if (row.activity_gear) gearSet.add(row.activity_gear);
        });

        if (gearSet.size > 0) {
            console.log(`✓ Found ${gearSet.size} unique gear items`);
            await insertGear(gearSet);
        }

        // Convert CSV rows to activity records
        console.log('\n📝 Converting activities...');
        const activities = parseResult.data
            .filter(row => row.activity_id) // Filter out rows without activity ID
            .map(row => {
                try {
                    return csvRowToActivity(row);
                } catch (error) {
                    console.error(`Error converting row ${row.activity_id}:`, error);
                    return null;
                }
            })
            .filter(activity => activity !== null); // Remove failed conversions

        console.log(`✓ Converted ${activities.length} activities\n`);

        // Insert activities
        console.log('💾 Inserting activities into database...');
        const results = await insertActivities(activities);

        // Print summary
        console.log('\n' + '='.repeat(50));
        console.log('📈 IMPORT SUMMARY');
        console.log('='.repeat(50));
        console.log(`✅ Successfully imported: ${results.success} activities`);
        console.log(`❌ Failed: ${results.failed} activities`);

        if (results.errors.length > 0) {
            console.log('\n⚠️  Errors encountered:');
            results.errors.forEach((error, index) => {
                console.log(`  ${index + 1}. ${error.message || error}`);
            });
        }

        console.log('\n✨ Import complete!');

    } catch (error) {
        console.error('\n❌ Fatal error during import:', error);
        process.exit(1);
    }
}

// Run the import
if (require.main === module) {
    importActivities()
        .then(() => process.exit(0))
        .catch(error => {
            console.error('Unhandled error:', error);
            process.exit(1);
        });
}

module.exports = { importActivities, csvRowToActivity };