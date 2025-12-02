// chat.js
// POST /api/chat - AI-powered conversational coaching

const express = require('express');
const logger = require('../utils/logger');

const router = express.Router();

/**
 * POST /api/chat
 * Send a message and get AI coach response
 *
 * Body:
 * {
 *   "athlete_id": 94451852,
 *   "message": "When did I last run over 10 miles?",
 *   "conversation_id": "optional-uuid-for-continuing-conversation"
 * }
 */
router.post('/', async (req, res, next) => {
    try {
        const { athlete_id, message, conversation_id } = req.body;

        if (!athlete_id || !message) {
            return res.status(400).json({
                error: {
                    code: 'INVALID_REQUEST',
                    message: 'athlete_id and message are required'
                }
            });
        }

        logger.info('Chat request', {
            athlete_id,
            messageLength: message.length,
            conversationId: conversation_id,
            isNewConversation: !conversation_id
        });

        // Get response from chat service
        const result = await req.chatService.chat(athlete_id, message, {
            conversationId: conversation_id
        });

        logger.info('Chat response', {
            athlete_id,
            responseLength: result.answer.length,
            conversationId: result.conversationId
        });

        res.json({
            answer: result.answer,
            conversation_id: result.conversationId,
            context: result.context,
            timestamp: new Date().toISOString()
        });

    } catch (error) {
        logger.error('Error in chat endpoint', {
            error: error.message,
            athlete_id: req.body.athlete_id
        });
        next(error);
    }
});

/**
 * GET /api/chat/history/:athlete_id
 * Get chat history for an athlete
 */
router.get('/history/:athlete_id', async (req, res, next) => {
    try {
        const { athlete_id } = req.params;
        const limit = parseInt(req.query.limit) || 20;

        logger.info('Fetching chat history', {
            athlete_id,
            limit
        });

        const history = await req.chatService.getHistory(athlete_id, limit);

        res.json({
            history: history,
            count: history.length
        });

    } catch (error) {
        logger.error('Error fetching chat history', {
            error: error.message,
            athlete_id: req.params.athlete_id
        });
        next(error);
    }
});

module.exports = router;
