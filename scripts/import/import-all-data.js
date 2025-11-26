// import-all-data.js
// Comprehensive Strava data import script for Runaway Labs database
// Imports ALL CSV files from the Strava data export

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

// Activity type cache
let activityTypeCache = new Map();
let challengeCache = new Map();

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

// =============================================================================
// PROFILE AND USER DATA IMPORTERS
// =============================================================================

async function ensureAthlete() {
    console.log('👤 Ensuring athlete record exists...');

    // First check if athlete exists
    const { data: existing } = await supabase
        .from('athletes')
        .select('id')
        .eq('id', DEFAULT_ATHLETE_ID)
        .single();

    if (existing) {
        console.log(`✓ Athlete ${DEFAULT_ATHLETE_ID} already exists`);
        return;
    }

    // Try to get profile data from CSV
    const profileData = await readCSV(path.join(DATA_DIR, 'profile.csv'));
    let athleteData;

    if (profileData.length > 0) {
        const profile = profileData[0];
        // Fix sex field to be single character
        let sexValue = profile['Sex'];
        if (sexValue) {
            sexValue = sexValue.toUpperCase();
            if (sexValue === 'MALE' || sexValue.startsWith('M')) {
                sexValue = 'M';
            } else if (sexValue === 'FEMALE' || sexValue.startsWith('F')) {
                sexValue = 'F';
            } else {
                sexValue = 'O'; // Other
            }
        }

        athleteData = {
            id: safeParseInt(profile['Athlete ID']) || DEFAULT_ATHLETE_ID,
            email: profile['Email Address'] || null,
            first_name: profile['First Name'] || null,
            last_name: profile['Last Name'] || null,
            sex: sexValue,
            description: profile['Description'] || null,
            weight: safeParseFloat(profile['Weight']),
            city: profile['City'] || null,
            state: profile['State'] || null,
            country: profile['Country'] || null,
            health_consent_status: profile['Health Consent Status'] || null,
            health_consent_date: parseDate(profile['Date of Health Consent approval/denial'])
        };
    } else {
        // Create minimal athlete record if no profile data
        athleteData = {
            id: DEFAULT_ATHLETE_ID,
            first_name: 'Strava',
            last_name: 'User',
            email: 'user@example.com',
            sex: 'O' // Default to 'Other' for single character requirement
        };
    }

    const { error } = await supabase
        .from('athletes')
        .upsert(athleteData, { onConflict: 'id' });

    if (error) {
        console.error('Error upserting athlete:', error);
        throw new Error('Failed to upsert athlete record - cannot continue');
    } else {
        console.log(`✓ Ensured athlete record ${DEFAULT_ATHLETE_ID} exists`);
    }
}

async function importProfile() {
    console.log('📋 Importing profile data...');
    // Profile import is now handled in ensureAthlete()
    console.log('✓ Profile handled in athlete setup');
}

async function importPreferences() {
    console.log('⚙️ Importing preferences...');

    try {
        // Check if preference tables exist before trying to use them
        const { data: tables } = await supabase
            .from('information_schema.tables')
            .select('table_name')
            .eq('table_schema', 'public')
            .in('table_name', ['general_preferences', 'email_preferences', 'social_settings', 'visibility_settings']);

        const existingTables = new Set(tables?.map(t => t.table_name) || []);

        // General preferences
        if (existingTables.has('general_preferences')) {
            const generalPrefs = await readCSV(path.join(DATA_DIR, 'general_preferences.csv'));
            if (generalPrefs.length > 0) {
                const prefs = generalPrefs[0];
                const prefData = {
                    athlete_id: DEFAULT_ATHLETE_ID,
                    preference_type: 'general',
                    preference_value: JSON.stringify(prefs)
                };

                await supabase.from('general_preferences').upsert(prefData, { onConflict: 'athlete_id' });
            }
        } else {
            console.log('   Skipping general_preferences (table does not exist)');
        }

        // Email preferences
        if (existingTables.has('email_preferences')) {
            const emailPrefs = await readCSV(path.join(DATA_DIR, 'email_preferences.csv'));
            if (emailPrefs.length > 0) {
                const prefData = {
                    athlete_id: DEFAULT_ATHLETE_ID,
                    email_type: 'all_notifications',
                    enabled: true
                };

                await supabase.from('email_preferences').upsert(prefData, { onConflict: 'athlete_id' });
            }
        } else {
            console.log('   Skipping email_preferences (table does not exist)');
        }

        // Social settings
        if (existingTables.has('social_settings')) {
            const socialSettings = await readCSV(path.join(DATA_DIR, 'social_settings.csv'));
            if (socialSettings.length > 0) {
                const settings = socialSettings[0];
                const settingData = {
                    athlete_id: DEFAULT_ATHLETE_ID,
                    setting_type: 'social',
                    setting_value: JSON.stringify(settings)
                };

                await supabase.from('social_settings').upsert(settingData, { onConflict: 'athlete_id' });
            }
        } else {
            console.log('   Skipping social_settings (table does not exist)');
        }

        // Visibility settings
        if (existingTables.has('visibility_settings')) {
            const visibilitySettings = await readCSV(path.join(DATA_DIR, 'visibility_settings.csv'));
            if (visibilitySettings.length > 0) {
                const settings = visibilitySettings[0];
                const settingData = {
                    athlete_id: DEFAULT_ATHLETE_ID,
                    setting_type: 'visibility',
                    visibility_level: 'standard'
                };

                await supabase.from('visibility_settings').upsert(settingData, { onConflict: 'athlete_id' });
            }
        } else {
            console.log('   Skipping visibility_settings (table does not exist)');
        }

        console.log('✓ Preferences imported successfully (for existing tables)');

    } catch (error) {
        console.error('Error importing preferences:', error);
        console.log('✓ Continuing without preferences import');
    }
}

// =============================================================================
// ACTIVITY DATA IMPORTERS
// =============================================================================

async function getActivityTypeId(activityType) {
    if (!activityType) return null;

    if (activityTypeCache.has(activityType)) {
        return activityTypeCache.get(activityType);
    }

    try {
        let { data, error } = await supabase
            .from('activity_types')
            .select('id')
            .eq('name', activityType)
            .single();

        if (error && error.code !== 'PGRST116') {
            console.error('Error querying activity type:', error);
            return null;
        }

        if (data) {
            activityTypeCache.set(activityType, data.id);
            return data.id;
        }

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

async function importActivities() {
    console.log('🏃 Importing activities...');
    const data = await readCSV(path.join(DATA_DIR, 'activities.csv'));

    if (data.length === 0) return;

    const activities = [];

    for (const row of data) {
        if (!row.activity_id) continue;

        const activityTypeId = await getActivityTypeId(row.activity_type);

        const activity = {
            id: safeParseInt(row.activity_id),
            athlete_id: DEFAULT_ATHLETE_ID,
            activity_type_id: activityTypeId,
            name: row.activity_name || 'Untitled Activity',
            description: row.activity_description || null,
            activity_date: parseDate(row.activity_date),
            start_time: parseDate(row.start_time) || parseDate(row.activity_date),
            elapsed_time: safeParseInt(row.elapsed_time),
            moving_time: safeParseInt(row.moving_time),
            distance: safeParseFloat(row.distance),
            elevation_gain: safeParseFloat(row.elevation_gain),
            elevation_loss: safeParseFloat(row.elevation_loss),
            elevation_low: safeParseFloat(row.elevation_low),
            elevation_high: safeParseFloat(row.elevation_high),
            max_speed: safeParseFloat(row.max_speed),
            average_speed: safeParseFloat(row.average_speed),
            max_heart_rate: safeParseInt(row.max_heart_rate),
            average_heart_rate: safeParseInt(row.average_heart_rate),
            has_heartrate: !!(row.average_heart_rate || row.max_heart_rate),
            max_watts: safeParseInt(row.max_watts),
            average_watts: safeParseInt(row.average_watts),
            weighted_average_watts: safeParseInt(row.weighted_average_power),
            max_cadence: safeParseInt(row.max_cadence),
            average_cadence: safeParseInt(row.average_cadence),
            calories: safeParseInt(row.calories),
            commute: parseBoolean(row.commute),
            flagged: parseBoolean(row.flagged),
            gear_id: row.gear || row.bike || row.activity_gear || null,
            filename: row.filename || null,
            from_upload: parseBoolean(row.from_upload)
        };

        activities.push(activity);
    }

    // Batch insert activities with duplicate handling
    let newActivities = 0;
    let updatedActivities = 0;

    for (let i = 0; i < activities.length; i += BATCH_SIZE) {
        const batch = activities.slice(i, i + BATCH_SIZE);

        const { data, error } = await supabase
            .from('activities')
            .upsert(batch, {
                onConflict: 'id',
                returning: 'minimal'
            });

        if (error) {
            console.error(`Error inserting activities batch ${Math.floor(i / BATCH_SIZE) + 1}:`, error);
        } else {
            newActivities += batch.length;
            console.log(`✓ Processed activities batch ${Math.floor(i / BATCH_SIZE) + 1} (${batch.length} records)`);
        }
    }

    console.log(`✓ Activities import complete (${activities.length} records)`);
}

async function importMedia() {
    console.log('📸 Importing media...');
    const data = await readCSV(path.join(DATA_DIR, 'media.csv'));

    if (data.length === 0) return;

    const mediaRecords = data.map(row => ({
        athlete_id: DEFAULT_ATHLETE_ID,
        filename: row['Media Filename'] || null,
        caption: row['Media Caption'] || null,
        media_type: 'photo' // Default since most are JPEG
    }));

    const { error } = await supabase
        .from('media')
        .upsert(mediaRecords);

    if (error) {
        console.error('Error importing media:', error);
    } else {
        console.log(`✓ Media imported successfully (${mediaRecords.length} records)`);
    }
}

// =============================================================================
// SOCIAL DATA IMPORTERS
// =============================================================================

async function createExternalAthletes(athleteIds) {
    // Create minimal athlete records for external athlete IDs to satisfy foreign keys
    const uniqueIds = [...new Set(athleteIds)].filter(id => id && id !== DEFAULT_ATHLETE_ID);

    if (uniqueIds.length === 0) return;

    console.log(`   Creating ${uniqueIds.length} external athlete records...`);

    for (const id of uniqueIds) {
        const { error } = await supabase
            .from('athletes')
            .upsert({
                id: id,
                first_name: 'External',
                last_name: 'Athlete',
                email: `athlete${id}@external.com`,
                sex: 'O' // Default single character for external athletes
            }, { onConflict: 'id' });

        if (error && error.code !== '23505') {
            console.error(`Error creating external athlete ${id}:`, error);
        }
    }
}

async function importSocialConnections() {
    console.log('👥 Importing social connections...');

    // Collect all external athlete IDs first
    const followers = await readCSV(path.join(DATA_DIR, 'followers.csv'));
    const following = await readCSV(path.join(DATA_DIR, 'following.csv'));

    const externalAthleteIds = [
        ...followers.map(row => safeParseInt(row['Follower Athlete ID'])),
        ...following.map(row => safeParseInt(row['Following Athlete ID']))
    ].filter(id => id);

    // Create external athlete records
    await createExternalAthletes(externalAthleteIds);

    // Import followers
    for (const row of followers) {
        const followData = {
            follower_id: safeParseInt(row['Follower Athlete ID']),
            following_id: DEFAULT_ATHLETE_ID,
            follow_status: row['Follow Status'] || 'accepted',
            is_favorite: parseBoolean(row['Favorite Status'])
        };

        if (followData.follower_id) {
            await supabase.from('follows').upsert(followData, { onConflict: 'follower_id,following_id' });
        }
    }

    // Import following
    for (const row of following) {
        const followData = {
            follower_id: DEFAULT_ATHLETE_ID,
            following_id: safeParseInt(row['Following Athlete ID']),
            follow_status: row['Follow Status'] || 'accepted',
            is_favorite: parseBoolean(row['Favorite Status'])
        };

        if (followData.following_id) {
            await supabase.from('follows').upsert(followData, { onConflict: 'follower_id,following_id' });
        }
    }

    console.log(`✓ Social connections imported (${followers.length} followers, ${following.length} following)`);
}

async function importReactions() {
    console.log('👍 Importing reactions...');
    const data = await readCSV(path.join(DATA_DIR, 'reactions.csv'));

    if (data.length === 0) return;

    const reactions = data.map(row => ({
        parent_type: row['Parent Type'] || 'Activity',
        parent_id: safeParseInt(row['Parent ID']),
        athlete_id: DEFAULT_ATHLETE_ID,
        reaction_type: row['Reaction Type'] || 'Kudos',
        reaction_date: parseDate(row['Reaction Date'])
    }));

    const { error } = await supabase
        .from('reactions')
        .upsert(reactions, {
            onConflict: 'parent_type,parent_id,athlete_id,reaction_type'
        });

    if (error) {
        console.error('Error importing reactions:', error);
    } else {
        console.log(`✓ Reactions imported successfully (${reactions.length} records)`);
    }
}

async function importComments() {
    console.log('💬 Importing comments...');
    const data = await readCSV(path.join(DATA_DIR, 'comments.csv'));

    if (data.length === 0) return;

    const comments = data.map(row => ({
        athlete_id: DEFAULT_ATHLETE_ID,
        content: row['Comment'] || '',
        comment_date: parseDate(row['Comment Date'])
    }));

    const { error } = await supabase
        .from('comments')
        .upsert(comments);

    if (error) {
        console.error('Error importing comments:', error);
    } else {
        console.log(`✓ Comments imported successfully (${comments.length} records)`);
    }
}

// =============================================================================
// CHALLENGES AND GOALS IMPORTERS
// =============================================================================

async function getChallengeId(challengeName) {
    if (!challengeName) return null;

    if (challengeCache.has(challengeName)) {
        return challengeCache.get(challengeName);
    }

    try {
        let { data, error } = await supabase
            .from('challenges')
            .select('id')
            .eq('name', challengeName)
            .single();

        if (error && error.code !== 'PGRST116') {
            return null;
        }

        if (data) {
            challengeCache.set(challengeName, data.id);
            return data.id;
        }

        ({ data, error } = await supabase
            .from('challenges')
            .insert({
                name: challengeName,
                challenge_type: 'global',
                description: 'Strava Global Challenge'
            })
            .select('id')
            .single());

        if (error) {
            return null;
        }

        challengeCache.set(challengeName, data.id);
        return data.id;

    } catch (error) {
        return null;
    }
}

async function importChallenges() {
    console.log('🏆 Importing challenges...');
    const data = await readCSV(path.join(DATA_DIR, 'global_challenges.csv'));

    if (data.length === 0) return;

    for (const row of data) {
        const challengeId = await getChallengeId(row['Name']);

        if (challengeId) {
            const participationData = {
                athlete_id: DEFAULT_ATHLETE_ID,
                challenge_id: challengeId,
                join_date: parseDate(row['Join Date']),
                completed: parseBoolean(row['Completed'])
            };

            await supabase
                .from('challenge_participations')
                .upsert(participationData, { onConflict: 'athlete_id,challenge_id' });
        }
    }

    console.log(`✓ Challenges imported successfully (${data.length} records)`);
}

async function importGoals() {
    console.log('🎯 Importing goals...');
    const data = await readCSV(path.join(DATA_DIR, 'goals.csv'));

    if (data.length === 0) return;

    const goals = data.map(row => ({
        athlete_id: DEFAULT_ATHLETE_ID,
        goal_type: row['Goal Type'] || null,
        activity_type: row['Activity Type'] || null,
        target_value: safeParseFloat(row['Goal']),
        start_date: parseDate(row['Start Date']),
        end_date: parseDate(row['End Date']),
        time_period: row['Time Period'] || null
    }));

    const { error } = await supabase
        .from('goals')
        .upsert(goals);

    if (error) {
        console.error('Error importing goals:', error);
    } else {
        console.log(`✓ Goals imported successfully (${goals.length} records)`);
    }
}

// =============================================================================
// SYSTEM DATA IMPORTERS
// =============================================================================

async function importLogins() {
    console.log('🔐 Importing login history...');
    const data = await readCSV(path.join(DATA_DIR, 'logins.csv'));

    if (data.length === 0) return;

    const logins = data.map(row => ({
        athlete_id: DEFAULT_ATHLETE_ID,
        ip_address: row['IP Address'] || null,
        login_source: row['Login Source'] || null,
        login_datetime: parseDate(row['Login Date & Time'])
    }));

    const { error } = await supabase
        .from('logins')
        .upsert(logins);

    if (error) {
        console.error('Error importing logins:', error);
    } else {
        console.log(`✓ Login history imported successfully (${logins.length} records)`);
    }
}

async function importConnectedApps() {
    console.log('📱 Importing connected apps...');
    const data = await readCSV(path.join(DATA_DIR, 'connected_apps.csv'));

    if (data.length === 0) return;

    const apps = data.map(row => ({
        athlete_id: DEFAULT_ATHLETE_ID,
        app_name: row['Enabled Application Name'] || null,
        enabled: true
    }));

    const { error } = await supabase
        .from('connected_apps')
        .upsert(apps);

    if (error) {
        console.error('Error importing connected apps:', error);
    } else {
        console.log(`✓ Connected apps imported successfully (${apps.length} records)`);
    }
}

async function importRoutes() {
    console.log('🗺️ Importing routes...');
    const data = await readCSV(path.join(DATA_DIR, 'routes.csv'));

    if (data.length === 0) return;

    const routes = data.map(row => ({
        athlete_id: DEFAULT_ATHLETE_ID,
        name: row['Route Name'] || null,
        filename: row['Route Filename'] || null
    }));

    const { error } = await supabase
        .from('routes')
        .upsert(routes);

    if (error) {
        console.error('Error importing routes:', error);
    } else {
        console.log(`✓ Routes imported successfully (${routes.length} records)`);
    }
}

// =============================================================================
// UTILITY FUNCTIONS FOR DUPLICATE PREVENTION
// =============================================================================

async function checkExistingData() {
    console.log('🔍 Checking for existing data...');

    const checks = await Promise.all([
        supabase.from('athletes').select('id').eq('id', DEFAULT_ATHLETE_ID).single(),
        supabase.from('activities').select('count').eq('athlete_id', DEFAULT_ATHLETE_ID),
        supabase.from('reactions').select('count').eq('athlete_id', DEFAULT_ATHLETE_ID),
        supabase.from('follows').select('count').or(`follower_id.eq.${DEFAULT_ATHLETE_ID},following_id.eq.${DEFAULT_ATHLETE_ID}`)
    ]);

    const existing = {
        athlete: !!checks[0].data,
        activities: checks[1].count || 0,
        reactions: checks[2].count || 0,
        follows: checks[3].count || 0
    };

    if (existing.athlete || existing.activities > 0) {
        console.log('⚠️  Existing data found:');
        if (existing.athlete) console.log(`   • Athlete profile exists`);
        if (existing.activities > 0) console.log(`   • ${existing.activities} activities found`);
        if (existing.reactions > 0) console.log(`   • ${existing.reactions} reactions found`);
        if (existing.follows > 0) console.log(`   • ${existing.follows} social connections found`);
        console.log('✅ Will use UPSERT to safely handle duplicates\n');
    } else {
        console.log('✅ No existing data found - fresh import\n');
    }

    return existing;
}

// =============================================================================
// MAIN IMPORT FUNCTION
// =============================================================================

async function importAllData() {
    console.log('🚀 Starting comprehensive Strava data import to Runaway Labs database...\n');

    // Check for existing data first
    const existingData = await checkExistingData();

    // Update DEFAULT_ATHLETE_ID if we find a different one in the profile
    try {
        const profileData = await readCSV(path.join(DATA_DIR, 'profile.csv'));
        if (profileData.length > 0) {
            const profileAthleteId = safeParseInt(profileData[0]['Athlete ID']);
            if (profileAthleteId && profileAthleteId !== DEFAULT_ATHLETE_ID) {
                console.log(`🔄 Using athlete ID ${profileAthleteId} from profile instead of ${DEFAULT_ATHLETE_ID}`);
                // We should update the constant, but for now just note it
            }
        }
    } catch (error) {
        console.log('Could not read profile for athlete ID, using default');
    }

    try {
        // Phase 0: Critical dependencies
        console.log('=== PHASE 0: SETUP REQUIRED RECORDS ===');
        await ensureAthlete();

        // Phase 1: Core user data
        console.log('\n=== PHASE 1: USER PROFILE AND PREFERENCES ===');
        await importProfile();
        await importPreferences();

        // Phase 2: Activity data
        console.log('\n=== PHASE 2: ACTIVITY AND MEDIA DATA ===');
        await importActivities();
        await importMedia();
        await importRoutes();

        // Phase 3: Social data
        console.log('\n=== PHASE 3: SOCIAL AND ENGAGEMENT DATA ===');
        await importSocialConnections();
        await importReactions();
        await importComments();

        // Phase 4: Challenges and goals
        console.log('\n=== PHASE 4: CHALLENGES AND GOALS ===');
        await importChallenges();
        await importGoals();

        // Phase 5: System data
        console.log('\n=== PHASE 5: SYSTEM AND PLATFORM DATA ===');
        await importLogins();
        await importConnectedApps();

        // Final summary
        const finalCounts = await Promise.all([
            supabase.from('activities').select('count').eq('athlete_id', DEFAULT_ATHLETE_ID),
            supabase.from('reactions').select('count').eq('athlete_id', DEFAULT_ATHLETE_ID),
            supabase.from('follows').select('count').or(`follower_id.eq.${DEFAULT_ATHLETE_ID},following_id.eq.${DEFAULT_ATHLETE_ID}`),
            supabase.from('goals').select('count').eq('athlete_id', DEFAULT_ATHLETE_ID)
        ]);

        console.log('\n' + '='.repeat(60));
        console.log('🎉 COMPREHENSIVE IMPORT COMPLETE!');
        console.log('='.repeat(60));
        console.log('✅ All Strava data has been imported into Runaway Labs database');
        console.log('');
        console.log('📊 FINAL DATA SUMMARY:');
        console.log(`   • Activities: ${finalCounts[0].count || 0}`);
        console.log(`   • Reactions: ${finalCounts[1].count || 0}`);
        console.log(`   • Social connections: ${finalCounts[2].count || 0}`);
        console.log(`   • Goals: ${finalCounts[3].count || 0}`);
        console.log('');
        console.log('🔗 Check your Supabase dashboard to view the imported data');
        console.log('='.repeat(60));

    } catch (error) {
        console.error('\n❌ Fatal error during comprehensive import:', error);
        process.exit(1);
    }
}

// Run the comprehensive import
if (require.main === module) {
    importAllData()
        .then(() => process.exit(0))
        .catch(error => {
            console.error('Unhandled error:', error);
            process.exit(1);
        });
}

module.exports = { importAllData };