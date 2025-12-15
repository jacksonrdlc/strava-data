// server.js
// Main entry point for Cloud Run service
// Sets up Express app, initializes services, and starts background job worker

const express = require('express');
const DatabaseClient = require('./services/DatabaseClient');
const TokenManager = require('./services/TokenManager');
const JobWorker = require('./services/JobWorker');
const EmbeddingService = require('./services/EmbeddingService');
const ChatService = require('./services/ChatService');
const MemoryService = require('./services/MemoryService');
const JournalService = require('./services/JournalService');
const errorHandler = require('./middleware/errorHandler');
const { authenticateIAM, skipAuth } = require('./middleware/auth');
const logger = require('./utils/logger');

// Load environment variables
require('dotenv').config({ path: './config/.env' });

// Validate required environment variables
const requiredEnv = [
    'SUPABASE_URL',
    'SUPABASE_SERVICE_KEY',
    'STRAVA_CLIENT_ID',
    'STRAVA_CLIENT_SECRET',
    'OAUTH_REDIRECT_URI'
];

for (const envVar of requiredEnv) {
    if (!process.env[envVar]) {
        logger.error(`Missing required environment variable: ${envVar}`);
        process.exit(1);
    }
}

// Initialize Express app
const app = express();
const port = process.env.PORT || 8080;

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Request logging
app.use((req, res, next) => {
    logger.info('Incoming request', {
        method: req.method,
        path: req.path,
        ip: req.ip
    });
    next();
});

// Initialize services
logger.info('Initializing services...');

const db = new DatabaseClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_KEY
);

const tokenManager = new TokenManager(
    db,
    process.env.STRAVA_CLIENT_ID,
    process.env.STRAVA_CLIENT_SECRET
);

const worker = new JobWorker(db, tokenManager);

// Initialize AI services (optional - only if API keys are provided)
let embeddingService = null;
let memoryService = null;
let chatService = null;
let journalService = null;

if (process.env.OPENAI_API_KEY) {
    logger.info('Initializing EmbeddingService...');
    embeddingService = new EmbeddingService(db, process.env.OPENAI_API_KEY);
} else {
    logger.warn('OPENAI_API_KEY not set - embedding features disabled');
}

if (process.env.ANTHROPIC_API_KEY) {
    logger.info('Initializing MemoryService...');
    memoryService = new MemoryService(db, process.env.ANTHROPIC_API_KEY);

    logger.info('Initializing JournalService...');
    journalService = new JournalService(db, process.env.ANTHROPIC_API_KEY);

    if (embeddingService) {
        logger.info('Initializing ChatService...');
        chatService = new ChatService(db, embeddingService, process.env.ANTHROPIC_API_KEY, memoryService);
    }
} else {
    logger.warn('ANTHROPIC_API_KEY not set - chat and journal features disabled');
}

// Attach services to request object for access in routes
app.use((req, res, next) => {
    req.db = db;
    req.tokenManager = tokenManager;
    req.worker = worker;
    req.embeddingService = embeddingService;
    req.chatService = chatService;
    req.journalService = journalService;
    next();
});

// ============================================================================
// Routes
// ============================================================================

// Health check (no auth required)
app.use('/health', require('./routes/health'));

// OAuth flow (no auth required for callbacks)
app.use('/api/oauth', require('./routes/oauth'));

// API routes (require IAM authentication)
// Note: In production with Cloud Run IAM enabled, auth is handled at platform level
// For development, you can toggle authentication here
const authMiddleware = process.env.NODE_ENV === 'development' ? skipAuth : authenticateIAM;

app.use('/api/sync', authMiddleware, require('./routes/sync'));
app.use('/api/sync-beta', skipAuth, require('./routes/sync-beta'));  // Public endpoint for iOS app
app.use('/api/jobs', authMiddleware, require('./routes/jobs'));
app.use('/api/chat', skipAuth, require('./routes/chat'));  // Public endpoint for iOS app
app.use('/api/journal', skipAuth, require('./routes/journal'));  // Public endpoint for iOS app

// Root endpoint
app.get('/', (req, res) => {
    res.json({
        service: 'Strava Sync Service',
        version: '1.0.0',
        endpoints: {
            health: 'GET /health',
            oauth_authorize: 'GET /api/oauth/authorize',
            oauth_callback: 'GET /api/oauth/callback',
            create_sync_job: 'POST /api/sync',
            create_sync_beta_job: 'POST /api/sync-beta (max 20 activities)',
            get_job_status: 'GET /api/jobs/:jobId',
            chat: 'POST /api/chat',
            chat_history: 'GET /api/chat/history/:athlete_id'
        },
        documentation: 'https://github.com/yourrepo/strava-sync'
    });
});

// 404 handler
app.use((req, res) => {
    res.status(404).json({
        error: {
            code: 'NOT_FOUND',
            message: `Route ${req.method} ${req.path} not found`
        }
    });
});

// Error handler (must be last)
app.use(errorHandler);

// ============================================================================
// Server Startup
// ============================================================================

const server = app.listen(port, '0.0.0.0', () => {
    logger.info('Server started', {
        port,
        host: '0.0.0.0',
        nodeEnv: process.env.NODE_ENV || 'production'
    });

    // Start background job worker
    logger.info('Starting job worker...');
    worker.start();
});

// ============================================================================
// Graceful Shutdown
// ============================================================================

process.on('SIGTERM', async () => {
    logger.info('SIGTERM received, starting graceful shutdown...');

    // Stop accepting new requests
    server.close(async () => {
        logger.info('HTTP server closed');

        // Shutdown job worker
        await worker.shutdown();

        logger.info('Graceful shutdown complete');
        process.exit(0);
    });

    // Force shutdown after 30 seconds
    setTimeout(() => {
        logger.error('Forced shutdown after timeout');
        process.exit(1);
    }, 30000);
});

process.on('SIGINT', async () => {
    logger.info('SIGINT received, starting graceful shutdown...');
    process.emit('SIGTERM');
});

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
    logger.error('Uncaught exception', {
        error: error.message,
        stack: error.stack
    });
    process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
    logger.error('Unhandled rejection', {
        reason,
        promise
    });
});

module.exports = app;
