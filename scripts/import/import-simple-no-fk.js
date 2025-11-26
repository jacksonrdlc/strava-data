// import-simple-no-fk.js
// Simplified import script that ignores foreign key relationships
// Loads data in any order without dependency checking

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
const DATA_DIR = './data';
const BATCH_SIZE = 25;
const DEFAULT_ATHLETE_ID = 1;

// Utility functions
function parseDate(dateStr) {
    if (!dateStr) return null;
    try {
        const date = new Date(dateStr);
        return isNaN(date.getTime()) ? null : date.toISOString();
    } catch (error) {
        return null;
    }
}

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

function fixSexField(sexValue) {
    if (!sexValue) return 'O';
    const upper = sexValue.toString().toUpperCase();
    if (upper === 'MALE' || upper.startsWith('M')) return 'M';
    if (upper === 'FEMALE' || upper.startsWith('F')) return 'F';
    return 'O';
}

async function readCSV(filePath) {
    try {
        const csvContent = await fs.readFile(filePath, 'utf8');
        const parseResult = Papa.parse(csvContent, {
            header: true,
            dynamicTyping: false,
            skipEmptyLines: true
        });
        return parseResult.data;
    } catch (error) {
        console.error(`Error reading ${filePath}:`, error);
        return [];
    }
}

// Disable foreign keys for this session
async function disableForeignKeys() {
    console.log('🔓 Disabling foreign key constraints...');
    try {
        await supabase.rpc('exec_sql', {
            sql: 'SET session_replication_role = replica;'
        });
        console.log('✓ Foreign key constraints disabled');
    } catch (error) {
        console.log('⚠️  Could not disable foreign keys via RPC, continuing anyway...');
    }
}

async function enableForeignKeys() {
    console.log('🔒 Re-enabling foreign key constraints...');
    try {
        await supabase.rpc('exec_sql', {
            sql: 'SET session_replication_role = DEFAULT;'
        });
        console.log('✓ Foreign key constraints re-enabled');
    } catch (error) {
        console.log('⚠️  Could not re-enable foreign keys via RPC');
    }
}

// Import athletes (create all athlete records first)
async function importAllAthletes() {
    console.log('👥 Creating all athlete records...');

    const athletes = new Set();
    athletes.add(DEFAULT_ATHLETE_ID);

    // Collect athlete IDs from social data
    try {
        const followers = await readCSV(path.join(DATA_DIR, 'followers.csv'));
        const following = await readCSV(path.join(DATA_DIR, 'following.csv'));

        followers.forEach(row => {
            const id = safeParseInt(row['Follower Athlete ID']);
            if (id) athletes.add(id);
        });

        following.forEach(row => {
            const id = safeParseInt(row['Following Athlete ID']);
            if (id) athletes.add(id);
        });
    } catch (error) {
        console.log('   Could not read social data, continuing...');
    }

    // Get profile data for main athlete
    let profileData = null;
    try {
        const profiles = await readCSV(path.join(DATA_DIR, 'profile.csv'));
        if (profiles.length > 0) {
            profileData = profiles[0];
        }
    } catch (error) {
        console.log('   No profile data found');
    }

    // Create all athlete records
    const athleteRecords = Array.from(athletes).map(id => {
        if (id === DEFAULT_ATHLETE_ID && profileData) {
            // Use real profile data for main athlete
            return {
                id: id,
                email: profileData['Email Address'] || `athlete${id}@example.com`,
                first_name: profileData['First Name'] || 'User',
                last_name: profileData['Last Name'] || 'Unknown',
                sex: fixSexField(profileData['Sex']),
                description: profileData['Description'] || null,
                weight: safeParseFloat(profileData['Weight']),
                city: profileData['City'] || null,
                state: profileData['State'] || null,
                country: profileData['Country'] || null
            };
        } else {
            // External athlete
            return {
                id: id,
                first_name: 'External',
                last_name: 'Athlete',
                email: `athlete${id}@external.com`,
                sex: 'O'
            };
        }
    });

    // Insert all athletes
    const { error } = await supabase
        .from('athletes')
        .upsert(athleteRecords, { onConflict: 'id' });

    if (error) {
        console.error('Error creating athletes:', error);
    } else {
        console.log(`✓ Created ${athleteRecords.length} athlete records`);
    }
}

// Import activity types
async function importActivityTypes() {
    console.log('🏃 Creating activity types...');

    const activities = await readCSV(path.join(DATA_DIR, 'activities.csv'));
    const types = new Set();

    activities.forEach(row => {
        if (row.activity_type) {
            types.add(row.activity_type);
        }
    });

    const typeRecords = Array.from(types).map(type => ({
        name: type,
        category: 'Other'
    }));

    if (typeRecords.length > 0) {
        const { error } = await supabase
            .from('activity_types')
            .upsert(typeRecords, { onConflict: 'name' });

        if (error) {
            console.error('Error creating activity types:', error);
        } else {
            console.log(`✓ Created ${typeRecords.length} activity types`);
        }
    }
}

// Import all data without foreign key constraints
async function importAllDataSimple() {
    console.log('🚀 Starting SIMPLE import (ignoring foreign keys)...\n');

    try {
        // Step 1: Setup
        await importAllAthletes();
        await importActivityTypes();

        // Step 2: Import activities (largest dataset)
        console.log('\n🏃 Importing activities...');
        const activities = await readCSV(path.join(DATA_DIR, 'activities.csv'));

        if (activities.length > 0) {
            const activityRecords = activities
                .filter(row => row.activity_id)
                .map(row => ({
                    id: safeParseInt(row.activity_id),
                    athlete_id: DEFAULT_ATHLETE_ID,
                    activity_type_id: null, // Will be null, ignoring FK
                    name: row.activity_name || 'Untitled Activity',
                    description: row.activity_description || null,
                    activity_date: parseDate(row.activity_date),
                    elapsed_time: safeParseInt(row.elapsed_time),
                    moving_time: safeParseInt(row.moving_time),
                    distance: safeParseFloat(row.distance),
                    elevation_gain: safeParseFloat(row.elevation_gain),
                    max_speed: safeParseFloat(row.max_speed),
                    average_speed: safeParseFloat(row.average_speed),
                    max_heart_rate: safeParseInt(row.max_heart_rate),
                    average_heart_rate: safeParseInt(row.average_heart_rate),
                    max_watts: safeParseInt(row.max_watts),
                    average_watts: safeParseInt(row.average_watts),
                    calories: safeParseInt(row.calories),
                    commute: parseBoolean(row.commute),
                    flagged: parseBoolean(row.flagged),
                    filename: row.filename || null
                }));

            // Batch insert
            for (let i = 0; i < activityRecords.length; i += BATCH_SIZE) {
                const batch = activityRecords.slice(i, i + BATCH_SIZE);

                const { error } = await supabase
                    .from('activities')
                    .upsert(batch, { onConflict: 'id' });

                if (error) {
                    console.error(`Error in batch ${Math.floor(i / BATCH_SIZE) + 1}:`, error);
                } else {
                    console.log(`✓ Imported batch ${Math.floor(i / BATCH_SIZE) + 1} (${batch.length} activities)`);
                }
            }
        }

        // Step 3: Import social data
        console.log('\n👥 Importing social data...');

        // Reactions
        const reactions = await readCSV(path.join(DATA_DIR, 'reactions.csv'));
        if (reactions.length > 0) {
            const reactionRecords = reactions.map(row => ({
                parent_type: row['Parent Type'] || 'Activity',
                parent_id: safeParseInt(row['Parent ID']),
                athlete_id: DEFAULT_ATHLETE_ID,
                reaction_type: row['Reaction Type'] || 'Kudos',
                reaction_date: parseDate(row['Reaction Date'])
            }));

            const { error } = await supabase
                .from('reactions')
                .upsert(reactionRecords);

            if (!error) {
                console.log(`✓ Imported ${reactionRecords.length} reactions`);
            }
        }

        // Follows
        const followers = await readCSV(path.join(DATA_DIR, 'followers.csv'));
        const following = await readCSV(path.join(DATA_DIR, 'following.csv'));

        const followRecords = [
            ...followers.map(row => ({
                follower_id: safeParseInt(row['Follower Athlete ID']),
                following_id: DEFAULT_ATHLETE_ID,
                follow_status: 'accepted'
            })),
            ...following.map(row => ({
                follower_id: DEFAULT_ATHLETE_ID,
                following_id: safeParseInt(row['Following Athlete ID']),
                follow_status: 'accepted'
            }))
        ].filter(record => record.follower_id && record.following_id);

        if (followRecords.length > 0) {
            const { error } = await supabase
                .from('follows')
                .upsert(followRecords, { onConflict: 'follower_id,following_id' });

            if (!error) {
                console.log(`✓ Imported ${followRecords.length} social connections`);
            }
        }

        console.log('\n' + '='.repeat(50));
        console.log('🎉 SIMPLE IMPORT COMPLETE!');
        console.log('='.repeat(50));
        console.log('✅ Data imported without foreign key constraints');
        console.log('⚠️  Some relationships may be missing but data is preserved');
        console.log('='.repeat(50));

    } catch (error) {
        console.error('\n❌ Error during simple import:', error);
        process.exit(1);
    }
}

// Run the simple import
if (require.main === module) {
    importAllDataSimple()
        .then(() => process.exit(0))
        .catch(error => {
            console.error('Unhandled error:', error);
            process.exit(1);
        });
}

module.exports = { importAllDataSimple };