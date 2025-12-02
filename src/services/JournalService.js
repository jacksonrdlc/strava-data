// JournalService.js
// Generates weekly AI-powered training journal entries

const logger = require('../utils/logger');
const ActivitySummarizer = require('./ActivitySummarizer');

class JournalService {
    constructor(databaseClient, anthropicApiKey) {
        if (!databaseClient) {
            throw new Error('DatabaseClient is required');
        }
        if (!anthropicApiKey) {
            throw new Error('Anthropic API key is required');
        }

        this.db = databaseClient;
        this.anthropicApiKey = anthropicApiKey;
        this.model = 'claude-3-opus-20240229';
        this.maxTokens = 4096;
    }

    /**
     * Generate journal entry for a specific week
     */
    async generateWeeklyJournal(athleteId, weekStartDate) {
        logger.info('Generating weekly journal', {
            athleteId,
            weekStartDate: weekStartDate.toISOString()
        });

        try {
            // Calculate week end date
            const weekEndDate = new Date(weekStartDate);
            weekEndDate.setDate(weekEndDate.getDate() + 6);

            // Get activities for the week
            const weekActivities = await this.getWeekActivities(athleteId, weekStartDate, weekEndDate);

            if (weekActivities.length === 0) {
                logger.info('No activities found for week', { athleteId, weekStartDate });
                return null;
            }

            // Calculate week statistics
            const weekStats = this.calculateWeekStats(weekActivities);

            // Get athlete profile for context
            const profile = await this.getAthleteProfile(athleteId);

            // Get previous week for comparison (optional)
            const previousWeekStart = new Date(weekStartDate);
            previousWeekStart.setDate(previousWeekStart.getDate() - 7);
            const previousWeekActivities = await this.getWeekActivities(
                athleteId,
                previousWeekStart,
                new Date(weekStartDate.getTime() - 1)
            );
            const previousWeekStats = previousWeekActivities.length > 0
                ? this.calculateWeekStats(previousWeekActivities)
                : null;

            // Generate narrative using Claude
            const { narrative, insights } = await this.generateNarrative(
                weekActivities,
                weekStats,
                previousWeekStats,
                profile
            );

            // Save journal entry
            const journalEntry = await this.saveJournalEntry(
                athleteId,
                weekStartDate,
                weekEndDate,
                narrative,
                weekStats,
                insights
            );

            logger.info('Weekly journal generated', {
                athleteId,
                journalId: journalEntry.id,
                narrativeLength: narrative.length
            });

            return journalEntry;

        } catch (error) {
            logger.error('Error generating weekly journal', {
                error: error.message,
                athleteId,
                weekStartDate
            });
            throw error;
        }
    }

    /**
     * Get activities for a specific week
     */
    async getWeekActivities(athleteId, startDate, endDate) {
        const { data: activities, error } = await this.db.supabase
            .from('activities')
            .select('*')
            .eq('athlete_id', athleteId)
            .gte('activity_date', startDate.toISOString())
            .lte('activity_date', endDate.toISOString())
            .order('activity_date', { ascending: true });

        if (error) {
            throw new Error(`Error fetching week activities: ${error.message}`);
        }

        return activities || [];
    }

    /**
     * Calculate statistics for the week
     */
    calculateWeekStats(activities) {
        const totalDistance = activities.reduce((sum, a) => sum + (parseFloat(a.distance) || 0), 0);
        const totalTime = activities.reduce((sum, a) => sum + (a.moving_time || 0), 0);
        const totalElevation = activities.reduce((sum, a) => sum + (a.elevation_gain || 0), 0);

        // Calculate average pace (weighted by distance)
        let totalPaceMinutes = 0;
        let totalDistanceForPace = 0;
        activities.forEach(a => {
            if (a.distance && a.moving_time && a.distance > 0) {
                const distanceMeters = parseFloat(a.distance);
                const paceMinPerMile = (a.moving_time / 60) / (distanceMeters * 0.000621371);
                totalPaceMinutes += paceMinPerMile * (distanceMeters * 0.000621371);
                totalDistanceForPace += distanceMeters * 0.000621371;
            }
        });

        const avgPaceMinPerMile = totalDistanceForPace > 0 ? totalPaceMinutes / totalDistanceForPace : 0;
        const avgPace = this.formatPace(avgPaceMinPerMile);

        // Find longest run
        const longestRun = Math.max(...activities.map(a => parseFloat(a.distance) || 0)) * 0.000621371;

        // Calculate average heart rate
        const activitiesWithHR = activities.filter(a => a.average_heart_rate);
        const avgHeartRate = activitiesWithHR.length > 0
            ? Math.round(activitiesWithHR.reduce((sum, a) => sum + a.average_heart_rate, 0) / activitiesWithHR.length)
            : null;

        return {
            total_distance_miles: ActivitySummarizer.metersToMiles(totalDistance),
            total_time_hours: (totalTime / 3600).toFixed(1),
            activities_count: activities.length,
            avg_pace: avgPace,
            longest_run_miles: longestRun.toFixed(2),
            elevation_gain_feet: Math.round(totalElevation * 3.28084),
            avg_heart_rate: avgHeartRate
        };
    }

    /**
     * Format pace as MM:SS
     */
    formatPace(paceMinPerMile) {
        if (!paceMinPerMile || paceMinPerMile === 0) return 'N/A';
        const minutes = Math.floor(paceMinPerMile);
        const seconds = Math.round((paceMinPerMile - minutes) * 60);
        return `${minutes}:${seconds.toString().padStart(2, '0')}`;
    }

    /**
     * Get athlete profile
     */
    async getAthleteProfile(athleteId) {
        const { data: profile } = await this.db.supabase
            .from('athlete_ai_profiles')
            .select('*')
            .eq('athlete_id', athleteId)
            .single();

        return profile;
    }

    /**
     * Generate narrative using Claude
     */
    async generateNarrative(activities, weekStats, previousWeekStats, profile) {
        const prompt = this.buildNarrativePrompt(activities, weekStats, previousWeekStats, profile);

        const response = await fetch('https://api.anthropic.com/v1/messages', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-api-key': this.anthropicApiKey,
                'anthropic-version': '2023-06-01'
            },
            body: JSON.stringify({
                model: this.model,
                max_tokens: this.maxTokens,
                messages: [{
                    role: 'user',
                    content: prompt
                }]
            })
        });

        if (!response.ok) {
            const error = await response.text();
            throw new Error(`Claude API error: ${response.status} - ${error}`);
        }

        const data = await response.json();
        const fullResponse = data.content[0].text;

        // Parse narrative and insights from response
        // Expected format: NARRATIVE:\n...\n\nINSIGHTS:\n...
        const parts = fullResponse.split('INSIGHTS:');
        const narrative = parts[0].replace('NARRATIVE:', '').trim();

        let insights = [];
        if (parts.length > 1) {
            const insightsText = parts[1].trim();
            insights = insightsText.split('\n')
                .filter(line => line.trim().startsWith('-'))
                .map(line => {
                    const text = line.replace(/^-\s*/, '').trim();
                    // Categorize insights
                    let type = 'observation';
                    if (text.toLowerCase().includes('achievement') || text.toLowerCase().includes('pr') || text.toLowerCase().includes('milestone')) {
                        type = 'achievement';
                    } else if (text.toLowerCase().includes('recommend') || text.toLowerCase().includes('should') || text.toLowerCase().includes('consider')) {
                        type = 'recommendation';
                    } else if (text.toLowerCase().includes('pattern') || text.toLowerCase().includes('consistently') || text.toLowerCase().includes('trend')) {
                        type = 'pattern';
                    }
                    return { type, text };
                });
        }

        return { narrative, insights };
    }

    /**
     * Build prompt for narrative generation
     */
    buildNarrativePrompt(activities, weekStats, previousWeekStats, profile) {
        const parts = [];

        parts.push('You are an experienced running coach writing a weekly training summary for your athlete.');
        parts.push('');

        // Athlete context
        if (profile && profile.core_memory) {
            const memory = profile.core_memory;
            parts.push('ATHLETE CONTEXT:');
            if (memory.goals?.primary) {
                parts.push(`- Goal: ${memory.goals.primary}`);
            }
            if (memory.personal?.experience_level) {
                parts.push(`- Experience: ${memory.personal.experience_level}`);
            }
            parts.push('');
        }

        // Week statistics
        parts.push('THIS WEEK\'S TRAINING:');
        parts.push(`- ${weekStats.activities_count} runs`);
        parts.push(`- ${weekStats.total_distance_miles} total miles`);
        parts.push(`- ${weekStats.total_time_hours} hours of running`);
        parts.push(`- Avg pace: ${weekStats.avg_pace}/mile`);
        parts.push(`- Longest run: ${weekStats.longest_run_miles} miles`);
        if (weekStats.avg_heart_rate) {
            parts.push(`- Avg HR: ${weekStats.avg_heart_rate} bpm`);
        }
        parts.push('');

        // Comparison to previous week
        if (previousWeekStats) {
            parts.push('COMPARISON TO LAST WEEK:');
            const distanceChange = ((weekStats.total_distance_miles - previousWeekStats.total_distance_miles) / previousWeekStats.total_distance_miles * 100).toFixed(1);
            parts.push(`- Distance: ${distanceChange > 0 ? '+' : ''}${distanceChange}%`);
            parts.push(`- Activities: ${weekStats.activities_count} vs ${previousWeekStats.activities_count}`);
            parts.push('');
        }

        // Individual activities
        parts.push('INDIVIDUAL RUNS:');
        activities.forEach((activity, index) => {
            const summary = ActivitySummarizer.generateSummary(activity);
            parts.push(`${index + 1}. ${summary}`);
        });
        parts.push('');

        parts.push('INSTRUCTIONS:');
        parts.push('Write a warm, encouraging weekly summary in 2-4 paragraphs. Include:');
        parts.push('1. Overview of the week and standout performances');
        parts.push('2. Progress towards goals (if applicable)');
        parts.push('3. Patterns or trends you notice');
        parts.push('4. Encouragement and forward-looking statement');
        parts.push('');
        parts.push('Then, provide 3-5 key insights as bullet points.');
        parts.push('');
        parts.push('Format your response as:');
        parts.push('NARRATIVE:');
        parts.push('[Your 2-4 paragraph summary]');
        parts.push('');
        parts.push('INSIGHTS:');
        parts.push('- [Insight 1]');
        parts.push('- [Insight 2]');
        parts.push('- [Insight 3]');

        return parts.join('\n');
    }

    /**
     * Save journal entry to database
     */
    async saveJournalEntry(athleteId, weekStartDate, weekEndDate, narrative, weekStats, insights) {
        const { data, error } = await this.db.supabase
            .from('training_journal')
            .insert({
                athlete_id: athleteId,
                week_start_date: weekStartDate.toISOString().split('T')[0],
                week_end_date: weekEndDate.toISOString().split('T')[0],
                narrative,
                week_stats: weekStats,
                insights,
                generation_model: this.model
            })
            .select()
            .single();

        if (error) {
            throw new Error(`Error saving journal entry: ${error.message}`);
        }

        return data;
    }

    /**
     * Get journal entries for an athlete
     */
    async getJournalEntries(athleteId, limit = 10) {
        const { data, error } = await this.db.supabase
            .from('training_journal')
            .select('*')
            .eq('athlete_id', athleteId)
            .order('week_start_date', { ascending: false })
            .limit(limit);

        if (error) {
            throw new Error(`Error fetching journal entries: ${error.message}`);
        }

        return data || [];
    }
}

module.exports = JournalService;
