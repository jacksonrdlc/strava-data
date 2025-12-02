#!/usr/bin/env node
// embed-activities.js
// CLI script to batch embed all activities

require('dotenv').config({ path: './config/.env' });

const DatabaseClient = require('../services/DatabaseClient');
const EmbeddingService = require('../services/EmbeddingService');
const logger = require('../utils/logger');

async function main() {
    const args = process.argv.slice(2);
    const command = args[0];

    if (!process.env.OPENAI_API_KEY) {
        console.error('❌ OPENAI_API_KEY environment variable is required');
        console.error('Set it in config/.env file');
        process.exit(1);
    }

    if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_KEY) {
        console.error('❌ SUPABASE_URL and SUPABASE_SERVICE_KEY are required');
        process.exit(1);
    }

    // Initialize services
    const db = new DatabaseClient(
        process.env.SUPABASE_URL,
        process.env.SUPABASE_SERVICE_KEY
    );

    const embeddingService = new EmbeddingService(db, process.env.OPENAI_API_KEY);

    console.log('🚀 Activity Embedding Service\n');

    try {
        switch (command) {
            case 'all':
                await embedAllMissing(embeddingService);
                break;

            case 'athlete':
                const athleteId = args[1];
                if (!athleteId) {
                    console.error('❌ Usage: node embed-activities.js athlete <athlete_id>');
                    process.exit(1);
                }
                await embedAthlete(embeddingService, athleteId);
                break;

            case 'test':
                await testSingleActivity(embeddingService, db, args[1]);
                break;

            case 'search':
                const query = args.slice(1).join(' ');
                if (!query) {
                    console.error('❌ Usage: node embed-activities.js search <query>');
                    process.exit(1);
                }
                await testSearch(embeddingService, query);
                break;

            default:
                printHelp();
                break;
        }
    } catch (error) {
        console.error('\n❌ Error:', error.message);
        logger.error('Script error', { error: error.message, stack: error.stack });
        process.exit(1);
    }

    process.exit(0);
}

async function embedAllMissing(embeddingService) {
    console.log('📊 Finding activities without embeddings...\n');

    const results = await embeddingService.embedMissingActivities({
        batchSize: 10,
        delayMs: 1000, // 1 second between batches to avoid rate limits
        onProgress: (progress) => {
            const percentage = ((progress.processed / progress.total) * 100).toFixed(1);
            console.log(`Progress: ${progress.processed}/${progress.total} (${percentage}%) - ✅ ${progress.success} | ❌ ${progress.failed}`);
        }
    });

    console.log('\n✅ Embedding complete!');
    console.log(`   Success: ${results.success}`);
    console.log(`   Failed: ${results.failed}`);

    if (results.errors.length > 0) {
        console.log('\n❌ Errors:');
        results.errors.forEach(err => {
            console.log(`   Activity ${err.activityId}: ${err.error}`);
        });
    }
}

async function embedAthlete(embeddingService, athleteId) {
    console.log(`📊 Embedding all activities for athlete ${athleteId}...\n`);

    const results = await embeddingService.embedAthleteActivities(athleteId, {
        batchSize: 10,
        delayMs: 1000,
        onProgress: (progress) => {
            const percentage = ((progress.processed / progress.total) * 100).toFixed(1);
            console.log(`Progress: ${progress.processed}/${progress.total} (${percentage}%) - ✅ ${progress.success} | ❌ ${progress.failed}`);
        }
    });

    console.log('\n✅ Embedding complete!');
    console.log(`   Success: ${results.success}`);
    console.log(`   Failed: ${results.failed}`);
}

async function testSingleActivity(embeddingService, db, activityId) {
    if (!activityId) {
        console.error('❌ Usage: node embed-activities.js test <activity_id>');
        process.exit(1);
    }

    console.log(`🧪 Testing single activity: ${activityId}\n`);

    // Fetch the activity
    const { data: activity, error } = await db.supabase
        .from('activities')
        .select('*')
        .eq('id', activityId)
        .single();

    if (error || !activity) {
        console.error('❌ Activity not found');
        process.exit(1);
    }

    console.log('Activity:', activity.name);
    console.log('Date:', new Date(activity.activity_date).toLocaleDateString());

    // Generate summary
    const ActivitySummarizer = require('../services/ActivitySummarizer');
    const summary = ActivitySummarizer.generateEmbeddingSummary(activity);
    console.log('\nGenerated Summary:');
    console.log(summary);

    // Embed it
    console.log('\n📤 Creating embedding...');
    const result = await embeddingService.embedActivity(activity);

    console.log('\n✅ Embedding created!');
    console.log('   Embedding ID:', result.id);

    // Parse the embedding string to get actual dimension
    try {
        const embeddingArray = JSON.parse(result.embedding);
        console.log('   Vector dimension:', embeddingArray.length);
        console.log('   First few values:', embeddingArray.slice(0, 5).map(v => v.toFixed(4)).join(', '));
    } catch (e) {
        console.log('   Embedding stored as string, length:', result.embedding.length);
    }
}

async function testSearch(embeddingService, query) {
    console.log(`🔍 Searching for: "${query}"\n`);

    const results = await embeddingService.searchSimilarActivities(query, {
        limit: 5,
        threshold: 0.5
    });

    if (results.length === 0) {
        console.log('❌ No matching activities found');
        return;
    }

    console.log(`Found ${results.length} similar activities:\n`);

    results.forEach((result, index) => {
        console.log(`${index + 1}. Activity ${result.activity_id}`);
        console.log(`   Similarity: ${(result.similarity * 100).toFixed(1)}%`);
        console.log(`   Date: ${new Date(result.activity_date).toLocaleDateString()}`);
        console.log(`   Summary: ${result.summary.substring(0, 100)}...`);
        console.log('');
    });
}

function printHelp() {
    console.log('Usage: node embed-activities.js <command> [options]\n');
    console.log('Commands:');
    console.log('  all                      Embed all activities that don\'t have embeddings');
    console.log('  athlete <athlete_id>     Embed all activities for a specific athlete');
    console.log('  test <activity_id>       Test embedding a single activity');
    console.log('  search <query>           Search for similar activities');
    console.log('\nExamples:');
    console.log('  node embed-activities.js all');
    console.log('  node embed-activities.js athlete 94451852');
    console.log('  node embed-activities.js test 16582041513');
    console.log('  node embed-activities.js search "long run over 10 miles"');
}

// Run the script
main();
