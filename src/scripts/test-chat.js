#!/usr/bin/env node
// test-chat.js
// CLI script to test Claude-powered chat locally

require('dotenv').config({ path: './config/.env' });

const DatabaseClient = require('../services/DatabaseClient');
const EmbeddingService = require('../services/EmbeddingService');
const ChatService = require('../services/ChatService');
const logger = require('../utils/logger');

async function main() {
    const args = process.argv.slice(2);

    if (args.length < 2) {
        printHelp();
        process.exit(1);
    }

    const athleteId = args[0];
    const question = args.slice(1).join(' ');

    if (!process.env.ANTHROPIC_API_KEY) {
        console.error('❌ ANTHROPIC_API_KEY environment variable is required');
        console.error('Get one at: https://console.anthropic.com/');
        process.exit(1);
    }

    if (!process.env.OPENAI_API_KEY) {
        console.error('❌ OPENAI_API_KEY environment variable is required');
        process.exit(1);
    }

    // Initialize services
    const db = new DatabaseClient(
        process.env.SUPABASE_URL,
        process.env.SUPABASE_SERVICE_KEY
    );

    const embeddingService = new EmbeddingService(db, process.env.OPENAI_API_KEY);
    const chatService = new ChatService(db, embeddingService, process.env.ANTHROPIC_API_KEY);

    console.log('🤖 Runaway AI Coach\n');
    console.log(`Athlete ID: ${athleteId}`);
    console.log(`Question: "${question}"`);
    console.log('\n⏳ Thinking...\n');

    try {
        const startTime = Date.now();
        const result = await chatService.chat(athleteId, question);
        const elapsedTime = ((Date.now() - startTime) / 1000).toFixed(2);

        console.log('💬 Coach Response:');
        console.log('─'.repeat(60));
        console.log(result.answer);
        console.log('─'.repeat(60));

        console.log('\n📊 Context Used:');
        console.log(`   Recent activities: ${result.context.recentActivitiesCount}`);
        console.log(`   Relevant activities: ${result.context.relevantActivitiesCount}`);
        console.log(`   Total activities: ${result.context.totalActivities}`);

        console.log(`\n⏱️  Response time: ${elapsedTime}s`);

    } catch (error) {
        console.error('\n❌ Error:', error.message);
        logger.error('Chat test error', { error: error.message, stack: error.stack });
        process.exit(1);
    }

    process.exit(0);
}

function printHelp() {
    console.log('Usage: node test-chat.js <athlete_id> <question>\n');
    console.log('Examples:');
    console.log('  node test-chat.js 94451852 "When did I last run over 10 miles?"');
    console.log('  node test-chat.js 94451852 "How does my pace this month compare to last month?"');
    console.log('  node test-chat.js 94451852 "Am I running too much this week?"');
    console.log('  node test-chat.js 94451852 "What should I focus on in my training?"');
}

main();
