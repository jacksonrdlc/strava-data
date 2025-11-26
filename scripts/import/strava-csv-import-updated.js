// strava-csv-import-updated.js
// Updated Node.js script to import Strava activities from CSV to Supabase
// Compatible with new Runaway Labs database schema

const fs = require('fs').promises;
const path = require('path');
const Papa = require('papaparse');
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

// Supabase configuration
const supabaseUrl = process.env.SUPABASE_URL || 'YOUR_SUPABASE_URL';
const supabaseKey = process.env.SUPABASE_SERVICE_KEY || 'YOUR_SUPABASE_SERVICE_KEY';
const supabase = createClient(supabaseUrl, supabaseKey);

// Configuration
const CSV_FILE_PATH = './data/activities.csv'; // Updated path
const BATCH_SIZE = 25; // Reduced for better error handling
const DEFAULT_ATHLETE_ID = 1;

// Activity type mapping cache
let activityTypeCache = new Map();

/**
 * Parse date string to ISO format
 */
function parseDate(dateStr) {
    if (!dateStr) return null;
    try {
        // Handle format like "Jun 30, 2023, 9:26:21 PM"
        const date = new Date(dateStr);
        if (isNaN(date.getTime())) return null;
        return date.toISOString();
    } catch (error) {
        console.error(`Error parsing date: ${dateStr}`, error);
        return null;
    }
}

/**
 * Safe number parsing with validation
 */
function safeParseFloat(value, defaultValue = null) {
    if (value === null || value === undefined || value === '') return defaultValue;
    const parsed = parseFloat(value);
    return isNaN(parsed) ? defaultValue : parsed;
}

function safeParseInt(value, defaultValue = null) {
    if (value === null || value === undefined || value === '') return defaultValue;
    const parsed = parseInt(value);
    return isNaN(parsed) ? defaultValue : parsed;
}

/**
 * Parse boolean values from CSV
 */
function parseBoolean(value) {
    if (value === null || value === undefined || value === '') return false;
    if (typeof value === 'boolean') return value;
    if (typeof value === 'number') return value === 1;
    if (typeof value === 'string') {
        const lower = value.toLowerCase();
        return lower === 'true' || lower === '1' || lower === 'yes';
    }
    return false;
}

/**
 * Get or create activity type ID
 */
async function getActivityTypeId(activityType) {
    if (!activityType) return null;

    // Check cache first
    if (activityTypeCache.has(activityType)) {
        return activityTypeCache.get(activityType);
    }

    try {
        // Try to find existing activity type
        let { data, error } = await supabase
            .from('activity_types')
            .select('id')
            .eq('name', activityType)
            .single();

        if (error && error.code !== 'PGRST116') { // PGRST116 = no rows returned
            console.error('Error querying activity type:', error);
            return null;
        }

        if (data) {
            activityTypeCache.set(activityType, data.id);
            return data.id;
        }

        // Create new activity type if it doesn't exist
        ({ data, error } = await supabase
            .from('activity_types')
            .insert({ name: activityType, category: 'Other' })
            .select('id')
            .single());

        if (error) {
            console.error('Error creating activity type:', error);
            return null;
        }

        activityTypeCache.set(activityType, data.id);
        return data.id;

    } catch (error) {
        console.error('Error with activity type:', error);
        return null;
    }
}

/**
 * Convert CSV row to activity record for new schema
 */
async function csvRowToActivity(row) {
    // Get activity type ID
    const activityTypeId = await getActivityTypeId(row.activity_type);

    // Use the correct elapsed_time field (position 16, not position 6)
    const elapsedTime = safeParseInt(row.elapsed_time) || 0; // This should be the second elapsed_time field
    const movingTime = safeParseInt(row.moving_time) || 0;

    // Use the correct distance field (position 18 in meters, not position 7 in miles)
    const distance = safeParseFloat(row.distance); // This should be the second distance field in meters

    return {
        // Core identifiers
        id: safeParseInt(row.activity_id),
        athlete_id: DEFAULT_ATHLETE_ID,
        activity_type_id: activityTypeId,
        name: row.activity_name || 'Untitled Activity',
        description: row.activity_description || null,

        // Temporal data
        activity_date: parseDate(row.activity_date),
        start_time: parseDate(row.start_time) || parseDate(row.activity_date),

        // Performance metrics
        elapsed_time: elapsedTime,
        moving_time: movingTime,
        timer_time: safeParseInt(row.timer_time),
        distance: distance,

        // Elevation data
        elevation_gain: safeParseFloat(row.elevation_gain),
        elevation_loss: safeParseFloat(row.elevation_loss),
        elevation_low: safeParseFloat(row.elevation_low),
        elevation_high: safeParseFloat(row.elevation_high),
        max_grade: safeParseFloat(row.max_grade),
        average_grade: safeParseFloat(row.average_grade),
        average_positive_grade: safeParseFloat(row.average_positive_grade),
        average_negative_grade: safeParseFloat(row.average_negative_grade),

        // Speed data
        max_speed: safeParseFloat(row.max_speed),
        average_speed: safeParseFloat(row.average_speed),
        average_elapsed_speed: safeParseFloat(row.average_elapsed_speed),

        // Heart rate data
        max_heart_rate: safeParseInt(row.max_heart_rate),
        average_heart_rate: safeParseInt(row.average_heart_rate),
        has_heartrate: !!(row.average_heart_rate || row.max_heart_rate),

        // Power data
        max_watts: safeParseInt(row.max_watts),
        average_watts: safeParseInt(row.average_watts),
        weighted_average_watts: safeParseInt(row.weighted_average_power),
        device_watts: !!row.average_watts,
        total_work: safeParseInt(row.total_work),

        // Cadence data
        max_cadence: safeParseInt(row.max_cadence),
        average_cadence: safeParseInt(row.average_cadence),

        // Environmental data
        calories: safeParseInt(row.calories),
        max_temperature: safeParseInt(row.max_temperature),
        average_temperature: safeParseInt(row.average_temperature),
        weather_condition: row.weather_condition || null,
        humidity: safeParseInt(row.humidity),
        wind_speed: safeParseFloat(row.wind_speed),
        wind_gust: safeParseFloat(row.wind_gust),
        wind_bearing: safeParseInt(row.wind_bearing),
        precipitation_intensity: safeParseFloat(row.precipitation_intensity),
        precipitation_probability: safeParseFloat(row.precipitation_probability),
        precipitation_type: row.precipitation_type || null,
        cloud_cover: safeParseFloat(row.cloud_cover),
        weather_visibility: safeParseFloat(row.weather_visibility),
        uv_index: safeParseInt(row.uv_index),
        weather_ozone: safeParseInt(row.weather_ozone),
        weather_pressure: safeParseFloat(row.weather_pressure),
        apparent_temperature: safeParseInt(row.apparent_temperature),
        dewpoint: safeParseInt(row.dewpoint),

        // Activity flags
        commute: parseBoolean(row.commute),
        flagged: parseBoolean(row.flagged),
        with_pet: parseBoolean(row.with_pet),
        competition: parseBoolean(row.competition),
        long_run: parseBoolean(row.long_run),
        for_a_cause: parseBoolean(row.for_a_cause),
        trainer: parseBoolean(row.trainer) || false,
        manual: parseBoolean(row.manual) || false,
        private: parseBoolean(row.private) || false,

        // File references
        filename: row.filename || null,

        // Gear reference
        gear_id: row.gear || row.bike || row.activity_gear || null,

        // Additional metrics
        perceived_exertion: safeParseInt(row.perceived_exertion),
        relative_effort: safeParseInt(row.relative_effort),
        training_load: safeParseInt(row.training_load),
        intensity: safeParseFloat(row.intensity),
        average_grade_adjusted_pace: safeParseFloat(row.average_grade_adjusted_pace),
        grade_adjusted_distance: safeParseFloat(row.grade_adjusted_distance),
        dirt_distance: safeParseFloat(row.dirt_distance),
        newly_explored_distance: safeParseFloat(row.newly_explored_distance),
        newly_explored_dirt_distance: safeParseFloat(row.newly_explored_dirt_distance),
        total_steps: safeParseInt(row.total_steps),
        carbon_saved: safeParseFloat(row.carbon_saved),
        pool_length: safeParseInt(row.pool_length),
        total_cycles: safeParseInt(row.total_cycles),
        jump_count: safeParseInt(row.jump_count),
        total_grit: safeParseFloat(row.total_grit),
        average_flow: safeParseFloat(row.average_flow),

        // Metadata
        from_upload: parseBoolean(row.from_upload),
        resource_state: 2,
        external_id: row.filename || null
    };
}

/**
 * Ensure athlete exists in new schema
 */
async function ensureAthlete(athleteId) {
    try {
        // Check if athlete exists
        const { data: existing } = await supabase
            .from('athletes')
            .select('id')
            .eq('id', athleteId)
            .single();

        if (existing) {
            console.log(`✓ Athlete ${athleteId} already exists`);
            return;
        }

        // Create athlete if doesn't exist
        const { error } = await supabase
            .from('athletes')
            .insert({
                id: athleteId,
                first_name: 'Strava',
                last_name: 'User'
            });

        if (error && error.code !== '23505') { // Ignore unique constraint violations
            console.error('Error creating athlete:', error);
        } else {
            console.log(`✓ Created athlete ${athleteId}`);
        }
    } catch (error) {
        console.error('Error ensuring athlete:', error);
    }
}

/**
 * Insert gear with new schema
 */
async function insertGear(gearSet, athleteId) {
    const gearArray = Array.from(gearSet).filter(id => id && id !== 'null' && id !== '');

    if (gearArray.length === 0) return;

    try {
        const gearRecords = gearArray.map(id => ({
            id: String(id),
            athlete_id: athleteId,
            gear_type: 'other', // We'll update this based on actual usage
            name: `Gear ${id}`,
            is_primary: false
        }));

        // Use individual inserts to handle conflicts better
        for (const gear of gearRecords) {
            const { error } = await supabase
                .from('gear')
                .upsert(gear, {
                    onConflict: 'id'
                });

            if (error && error.code !== '23505') {
                console.error(`Error inserting gear ${gear.id}:`, error);
            }
        }

        console.log(`✓ Processed ${gearArray.length} gear items`);
    } catch (error) {
        console.error('Error with gear insertion:', error);
    }
}

/**
 * Insert activities in batches with better error handling
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
                    onConflict: 'id'
                });

            if (error) {
                console.error(`Error in batch ${Math.floor(i / BATCH_SIZE) + 1}:`, error);
                results.failed += batch.length;
                results.errors.push(error);

                // Try individual inserts for this batch
                console.log('Attempting individual inserts for failed batch...');
                for (const activity of batch) {
                    try {
                        const { error: individualError } = await supabase
                            .from('activities')
                            .upsert(activity, { onConflict: 'id' });

                        if (individualError) {
                            console.error(`Failed to insert activity ${activity.id}:`, individualError);
                        } else {
                            results.success++;
                            results.failed--;
                        }
                    } catch (individualError) {
                        console.error(`Individual insert failed for ${activity.id}:`, individualError);
                    }
                }
            } else {
                results.success += batch.length;
                console.log(`✓ Inserted batch ${Math.floor(i / BATCH_SIZE) + 1} (${batch.length} records)`);
            }
        } catch (error) {
            console.error(`Error processing batch ${Math.floor(i / BATCH_SIZE) + 1}:`, error);
            results.failed += batch.length;
            results.errors.push(error);
        }

        // Add delay between batches
        await new Promise(resolve => setTimeout(resolve, 200));
    }

    return results;
}

/**
 * Main import function
 */
async function importActivities() {
    console.log('🚀 Starting Strava CSV import to Runaway Labs database...\n');

    try {
        // Verify CSV file exists
        try {
            await fs.access(CSV_FILE_PATH);
        } catch (error) {
            console.error(`❌ CSV file not found: ${CSV_FILE_PATH}`);
            console.log('💡 Make sure your activities.csv file is in the data/ directory');
            return;
        }

        // Read CSV file
        console.log(`📄 Reading CSV file: ${CSV_FILE_PATH}`);
        const csvContent = await fs.readFile(CSV_FILE_PATH, 'utf8');

        // Parse CSV
        console.log('📊 Parsing CSV data...');
        const parseResult = Papa.parse(csvContent, {
            header: true,
            dynamicTyping: false, // Keep as strings for better control
            skipEmptyLines: true
        });

        if (parseResult.errors.length > 0) {
            console.warn('⚠️  CSV parsing warnings:', parseResult.errors.slice(0, 5));
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
            await insertGear(gearSet, DEFAULT_ATHLETE_ID);
        }

        // Convert CSV rows to activity records
        console.log('\n📝 Converting activities...');
        const activities = [];

        for (let i = 0; i < parseResult.data.length; i++) {
            const row = parseResult.data[i];

            if (!row.activity_id) continue; // Skip rows without activity ID

            try {
                const activity = await csvRowToActivity(row);
                if (activity && activity.id) {
                    activities.push(activity);
                }

                // Progress indicator
                if ((i + 1) % 100 === 0) {
                    console.log(`  Processed ${i + 1}/${parseResult.data.length} rows...`);
                }
            } catch (error) {
                console.error(`Error converting row ${row.activity_id}:`, error);
            }
        }

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
        console.log(`📊 Total processed: ${activities.length} activities`);

        if (results.errors.length > 0) {
            console.log('\n⚠️  Error summary:');
            const errorCounts = {};
            results.errors.forEach(error => {
                const msg = error.message || error.toString();
                errorCounts[msg] = (errorCounts[msg] || 0) + 1;
            });

            Object.entries(errorCounts).forEach(([error, count]) => {
                console.log(`  • ${error} (${count} times)`);
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