// journal.js
// API routes for training journal

const express = require('express');
const logger = require('../utils/logger');

const router = express.Router();

/**
 * POST /api/journal/generate
 * Generate a journal entry for a specific week
 *
 * Body:
 * {
 *   "athlete_id": 94451852,
 *   "week_start_date": "2025-11-25"  // Monday of the week (YYYY-MM-DD)
 * }
 */
router.post('/generate', async (req, res, next) => {
    try {
        const { athlete_id, week_start_date } = req.body;

        if (!athlete_id) {
            return res.status(400).json({
                error: {
                    code: 'INVALID_REQUEST',
                    message: 'athlete_id is required'
                }
            });
        }

        // Default to start of current week if not provided
        let weekStart;
        if (week_start_date) {
            weekStart = new Date(week_start_date);
        } else {
            // Get Monday of current week
            const today = new Date();
            const dayOfWeek = today.getDay();
            const daysToMonday = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
            weekStart = new Date(today);
            weekStart.setDate(today.getDate() + daysToMonday);
            weekStart.setHours(0, 0, 0, 0);
        }

        logger.info('Generating journal entry', {
            athlete_id,
            week_start_date: weekStart.toISOString()
        });

        // Generate journal
        const journalEntry = await req.journalService.generateWeeklyJournal(athlete_id, weekStart);

        if (!journalEntry) {
            return res.status(404).json({
                error: {
                    code: 'NO_ACTIVITIES',
                    message: 'No activities found for this week'
                }
            });
        }

        res.json({
            success: true,
            journal: journalEntry
        });

    } catch (error) {
        logger.error('Error in journal generation endpoint', {
            error: error.message,
            athlete_id: req.body.athlete_id
        });
        next(error);
    }
});

/**
 * GET /api/journal/:athlete_id
 * Get journal entries for an athlete
 *
 * Query params:
 * - limit: number of entries to return (default: 10)
 */
router.get('/:athlete_id', async (req, res, next) => {
    try {
        const { athlete_id } = req.params;
        const limit = parseInt(req.query.limit) || 10;

        logger.info('Fetching journal entries', {
            athlete_id,
            limit
        });

        const entries = await req.journalService.getJournalEntries(parseInt(athlete_id), limit);

        res.json({
            success: true,
            entries,
            count: entries.length
        });

    } catch (error) {
        logger.error('Error fetching journal entries', {
            error: error.message,
            athlete_id: req.params.athlete_id
        });
        next(error);
    }
});

/**
 * POST /api/journal/generate-recent
 * Generate journal entries for the last N weeks
 * Useful for backfilling or catching up
 *
 * Body:
 * {
 *   "athlete_id": 94451852,
 *   "weeks": 4  // Number of weeks to generate (default: 4)
 * }
 */
router.post('/generate-recent', async (req, res, next) => {
    try {
        const { athlete_id, weeks = 4 } = req.body;

        if (!athlete_id) {
            return res.status(400).json({
                error: {
                    code: 'INVALID_REQUEST',
                    message: 'athlete_id is required'
                }
            });
        }

        logger.info('Generating recent journal entries', {
            athlete_id,
            weeks
        });

        const generatedEntries = [];
        const today = new Date();

        // Generate for each of the last N weeks
        for (let i = weeks - 1; i >= 0; i--) {
            const weekStart = new Date(today);
            const dayOfWeek = today.getDay();
            const daysToMonday = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
            weekStart.setDate(today.getDate() + daysToMonday - (i * 7));
            weekStart.setHours(0, 0, 0, 0);

            try {
                const entry = await req.journalService.generateWeeklyJournal(athlete_id, weekStart);
                if (entry) {
                    generatedEntries.push(entry);
                }
            } catch (error) {
                logger.warn('Failed to generate journal for week', {
                    athlete_id,
                    week_start: weekStart.toISOString(),
                    error: error.message
                });
            }
        }

        res.json({
            success: true,
            generated: generatedEntries.length,
            entries: generatedEntries
        });

    } catch (error) {
        logger.error('Error in batch journal generation', {
            error: error.message,
            athlete_id: req.body.athlete_id
        });
        next(error);
    }
});

module.exports = router;
