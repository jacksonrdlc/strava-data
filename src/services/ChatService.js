// ChatService.js
// Claude-powered conversational coaching with RAG over activity history

const logger = require('../utils/logger');
const ActivitySummarizer = require('./ActivitySummarizer');

class ChatService {
    constructor(databaseClient, embeddingService, anthropicApiKey, memoryService = null) {
        if (!databaseClient || !embeddingService) {
            throw new Error('DatabaseClient and EmbeddingService are required');
        }
        if (!anthropicApiKey) {
            throw new Error('Anthropic API key is required');
        }

        this.db = databaseClient;
        this.embeddingService = embeddingService;
        this.anthropicApiKey = anthropicApiKey;
        this.memoryService = memoryService;
        this.model = 'claude-3-opus-20240229'; // Claude 3 Opus
        this.maxTokens = 4096;
    }

    /**
     * Get or create athlete's AI profile (core memory)
     */
    async getAthleteProfile(athleteId) {
        logger.info('Fetching athlete AI profile', { athleteId });

        // Try to get existing profile
        const { data: profile, error } = await this.db.supabase
            .from('athlete_ai_profiles')
            .select('*')
            .eq('athlete_id', athleteId)
            .single();

        if (error && error.code !== 'PGRST116') { // PGRST116 = not found
            throw new Error(`Error fetching profile: ${error.message}`);
        }

        // If no profile exists, create a basic one
        if (!profile) {
            logger.info('Creating new AI profile', { athleteId });

            const { data: newProfile, error: createError } = await this.db.supabase
                .from('athlete_ai_profiles')
                .insert({
                    athlete_id: athleteId,
                    core_memory: {
                        athlete_id: athleteId,
                        created_at: new Date().toISOString(),
                        preferences: {
                            coaching_style: 'supportive',
                            verbosity: 'concise'
                        }
                    },
                    preferences: {}
                })
                .select()
                .single();

            if (createError) {
                throw new Error(`Error creating profile: ${createError.message}`);
            }

            return newProfile;
        }

        return profile;
    }

    /**
     * Get recent activity summary (last 14 days)
     */
    async getRecentActivities(athleteId, days = 14) {
        const cutoffDate = new Date();
        cutoffDate.setDate(cutoffDate.getDate() - days);

        const { data: activities, error } = await this.db.supabase
            .from('activities')
            .select('*')
            .eq('athlete_id', athleteId)
            .gte('activity_date', cutoffDate.toISOString())
            .order('activity_date', { ascending: false })
            .limit(20);

        if (error) {
            throw new Error(`Error fetching recent activities: ${error.message}`);
        }

        return activities || [];
    }

    /**
     * Build context for Claude from athlete data
     */
    async buildContext(athleteId, userQuery, options = {}) {
        const {
            includeRecentActivities = true,
            searchHistoricalActivities = true,
            maxHistoricalResults = 5
        } = options;

        const context = {
            profile: null,
            recentActivities: [],
            relevantActivities: [],
            stats: {}
        };

        // Get athlete profile
        context.profile = await this.getAthleteProfile(athleteId);

        // Get recent activities (last 14 days)
        if (includeRecentActivities) {
            context.recentActivities = await this.getRecentActivities(athleteId);
        }

        // Search for relevant historical activities
        if (searchHistoricalActivities) {
            // Check if query is asking about "last" or "recent" - if so, prioritize date ordering
            const isTemporalQuery = /\b(last|recent|latest|when did i|most recent)\b/i.test(userQuery);

            if (isTemporalQuery) {
                // For temporal queries, combine semantic search with date ordering
                const searchResults = await this.embeddingService.searchSimilarActivities(userQuery, {
                    athleteId: athleteId,
                    limit: 10, // Get more results for temporal queries
                    threshold: 0.5 // Lower threshold to get more candidates
                });

                if (searchResults.length > 0) {
                    const activityIds = searchResults.map(r => r.activity_id);
                    const { data: fullActivities, error } = await this.db.supabase
                        .from('activities')
                        .select('*')
                        .in('id', activityIds)
                        .order('activity_date', { ascending: false }); // Sort by date

                    if (!error && fullActivities) {
                        context.relevantActivities = fullActivities.slice(0, maxHistoricalResults);
                    }
                }
            } else {
                // For non-temporal queries, use standard semantic search
                const searchResults = await this.embeddingService.searchSimilarActivities(userQuery, {
                    athleteId: athleteId,
                    limit: maxHistoricalResults,
                    threshold: 0.6
                });

                if (searchResults.length > 0) {
                    const activityIds = searchResults.map(r => r.activity_id);
                    const { data: fullActivities, error } = await this.db.supabase
                        .from('activities')
                        .select('*')
                        .in('id', activityIds);

                    if (!error && fullActivities) {
                        context.relevantActivities = fullActivities;
                    }
                }
            }
        }

        // Calculate some basic stats
        const { data: stats } = await this.db.supabase
            .from('activities')
            .select('distance, moving_time')
            .eq('athlete_id', athleteId);

        if (stats && stats.length > 0) {
            const totalDistance = stats.reduce((sum, a) => sum + (parseFloat(a.distance) || 0), 0);
            const totalTime = stats.reduce((sum, a) => sum + (a.moving_time || 0), 0);

            context.stats = {
                totalActivities: stats.length,
                totalDistanceMiles: ActivitySummarizer.metersToMiles(totalDistance),
                totalHours: (totalTime / 3600).toFixed(1)
            };
        }

        return context;
    }

    /**
     * Format context into prompt for Claude
     */
    formatPrompt(userQuery, context) {
        const parts = [];

        // System context
        parts.push('You are an experienced running coach with deep expertise in exercise physiology, training periodization, and athlete psychology.');
        parts.push('');

        // Athlete stats
        if (context.stats.totalActivities > 0) {
            parts.push('ATHLETE STATISTICS:');
            parts.push(`- Total activities: ${context.stats.totalActivities}`);
            parts.push(`- Total distance: ${context.stats.totalDistanceMiles} miles`);
            parts.push(`- Total time: ${context.stats.totalHours} hours`);
            parts.push('');
        }

        // Recent training (last 14 days)
        if (context.recentActivities.length > 0) {
            parts.push('RECENT TRAINING (last 14 days):');
            context.recentActivities.forEach(activity => {
                const summary = ActivitySummarizer.generateSummary(activity);
                parts.push(`- ${summary}`);
            });
            parts.push('');
        }

        // Relevant historical activities (from semantic search)
        if (context.relevantActivities.length > 0) {
            parts.push('RELEVANT HISTORICAL ACTIVITIES:');
            context.relevantActivities.forEach(activity => {
                const summary = ActivitySummarizer.generateDetailedSummary(activity);
                parts.push(`- ${summary}`);
            });
            parts.push('');
        }

        // User query
        parts.push('ATHLETE QUESTION:');
        parts.push(userQuery);
        parts.push('');

        // Instructions
        parts.push('INSTRUCTIONS:');
        parts.push('- Provide a clear, concise answer based on the data above');
        parts.push('- Reference specific activities and dates when relevant');
        parts.push('- Explain the "why" behind patterns, not just the "what"');
        parts.push('- If data is insufficient to answer, say so honestly');
        parts.push('- Be encouraging and supportive in tone');
        parts.push('- Keep response to 3-5 sentences unless more detail is needed');

        return parts.join('\n');
    }

    /**
     * Format prompt with conversation history for Claude
     */
    formatPromptWithHistory(userQuery, context, conversationHistory) {
        const parts = [];

        // System context
        parts.push('You are an experienced running coach with deep expertise in exercise physiology, training periodization, and athlete psychology.');
        parts.push('');

        // Include athlete profile/memory if available
        if (context.profile && context.profile.core_memory) {
            const memory = context.profile.core_memory;
            parts.push('ATHLETE PROFILE & MEMORY:');

            // Personal info
            if (memory.personal) {
                if (memory.personal.preferred_name || memory.personal.experience_level) {
                    parts.push(`- Athlete: ${memory.personal.preferred_name || 'Runner'} (${memory.personal.experience_level || 'runner'})`);
                }
            }

            // Current goals
            if (memory.goals) {
                if (memory.goals.primary) {
                    parts.push(`- Current Goal: ${memory.goals.primary}`);
                }
                if (memory.goals.race_schedule && memory.goals.race_schedule.length > 0) {
                    const upcoming = memory.goals.race_schedule[0];
                    parts.push(`- Upcoming Race: ${upcoming.event} (${upcoming.date})`);
                }
            }

            // Physical profile (injuries, concerns)
            if (memory.physical_profile) {
                if (memory.physical_profile.current_concerns && memory.physical_profile.current_concerns.length > 0) {
                    parts.push(`- Current Concerns: ${memory.physical_profile.current_concerns.join(', ')}`);
                }
                if (memory.physical_profile.injuries_history && memory.physical_profile.injuries_history.length > 0) {
                    const recentInjuries = memory.physical_profile.injuries_history.slice(0, 2);
                    parts.push(`- Injury History: ${recentInjuries.map(i => `${i.type} (${i.status})`).join(', ')}`);
                }
            }

            // Training preferences
            if (memory.training_preferences) {
                if (memory.training_preferences.coaching_style) {
                    parts.push(`- Coaching Style Preference: ${memory.training_preferences.coaching_style}`);
                }
            }

            parts.push('');
        }

        // Add conversation history if exists
        if (conversationHistory.length > 0) {
            parts.push('CONVERSATION HISTORY:');
            conversationHistory.forEach(msg => {
                const role = msg.role === 'user' ? 'ATHLETE' : 'COACH';
                parts.push(`${role}: ${msg.message}`);
            });
            parts.push('');
        }

        // Athlete stats
        if (context.stats.totalActivities > 0) {
            parts.push('ATHLETE STATISTICS:');
            parts.push(`- Total activities: ${context.stats.totalActivities}`);
            parts.push(`- Total distance: ${context.stats.totalDistanceMiles} miles`);
            parts.push(`- Total time: ${context.stats.totalHours} hours`);
            parts.push('');
        }

        // Recent training (last 14 days)
        if (context.recentActivities.length > 0) {
            parts.push('RECENT TRAINING (last 14 days):');
            context.recentActivities.forEach(activity => {
                const summary = ActivitySummarizer.generateSummary(activity);
                parts.push(`- ${summary}`);
            });
            parts.push('');
        }

        // Relevant historical activities (from semantic search)
        if (context.relevantActivities.length > 0) {
            parts.push('RELEVANT HISTORICAL ACTIVITIES:');
            context.relevantActivities.forEach(activity => {
                const summary = ActivitySummarizer.generateDetailedSummary(activity);
                parts.push(`- ${summary}`);
            });
            parts.push('');
        }

        // Current question
        parts.push('CURRENT ATHLETE QUESTION:');
        parts.push(userQuery);
        parts.push('');

        // Instructions
        parts.push('INSTRUCTIONS:');
        parts.push('- Continue the conversation naturally, building on previous context');
        parts.push('- Provide a clear, concise answer based on the data above');
        parts.push('- Reference specific activities and dates when relevant');
        parts.push('- Explain the "why" behind patterns, not just the "what"');
        parts.push('- If data is insufficient to answer, say so honestly');
        parts.push('- Be encouraging and supportive in tone');
        parts.push('- Keep response to 3-5 sentences unless more detail is needed');

        return parts.join('\n');
    }

    /**
     * Call Claude API
     */
    async callClaude(prompt, options = {}) {
        const {
            systemPrompt = 'You are an experienced running coach.',
            maxTokens = this.maxTokens
        } = options;

        try {
            const response = await fetch('https://api.anthropic.com/v1/messages', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'x-api-key': this.anthropicApiKey,
                    'anthropic-version': '2023-06-01'
                },
                body: JSON.stringify({
                    model: this.model,
                    max_tokens: maxTokens,
                    messages: [{
                        role: 'user',
                        content: prompt
                    }],
                    system: systemPrompt
                })
            });

            if (!response.ok) {
                const error = await response.text();
                throw new Error(`Claude API error: ${response.status} - ${error}`);
            }

            const data = await response.json();
            return data.content[0].text;

        } catch (error) {
            logger.error('Error calling Claude API', {
                error: error.message
            });
            throw error;
        }
    }

    /**
     * Load conversation history
     */
    async loadConversationHistory(conversationId, limit = 10) {
        const { data, error } = await this.db.supabase
            .from('chat_conversations')
            .select('role, message, timestamp')
            .eq('conversation_id', conversationId)
            .order('timestamp', { ascending: true })
            .limit(limit);

        if (error) {
            logger.error('Error loading conversation history', {
                error: error.message,
                conversationId
            });
            return [];
        }

        return data || [];
    }

    /**
     * Main chat method - answer athlete's question
     */
    async chat(athleteId, userQuery, options = {}) {
        const {
            conversationId = null, // UUID of existing conversation, or null for new
            includeHistory = true,
            historyLimit = 10
        } = options;

        // Generate conversation ID if not provided
        const { randomUUID } = await import('crypto');
        const currentConversationId = conversationId || randomUUID();

        logger.info('Processing chat query', {
            athleteId,
            query: userQuery,
            conversationId: currentConversationId,
            isNewConversation: !conversationId
        });

        try {
            // Load conversation history if conversation ID provided
            let conversationHistory = [];
            if (conversationId && includeHistory) {
                conversationHistory = await this.loadConversationHistory(conversationId, historyLimit);
                logger.info('Loaded conversation history', {
                    messageCount: conversationHistory.length
                });
            }

            // Build context from athlete's data
            const context = await this.buildContext(athleteId, userQuery, options);

            // Format prompt for Claude (including conversation history)
            const prompt = this.formatPromptWithHistory(userQuery, context, conversationHistory);

            logger.info('Sending to Claude', {
                athleteId,
                promptLength: prompt.length,
                recentActivities: context.recentActivities.length,
                relevantActivities: context.relevantActivities.length,
                historyMessages: conversationHistory.length
            });

            // Get response from Claude
            const response = await this.callClaude(prompt);

            // Store conversation in database
            await this.storeConversation(athleteId, userQuery, response, context, currentConversationId);

            // Extract and update memory asynchronously (don't block response)
            if (this.memoryService) {
                this.memoryService.extractMemoryFromConversation(athleteId, userQuery, response, context)
                    .then(memoryUpdates => {
                        if (memoryUpdates) {
                            return this.memoryService.updateAthleteMemory(athleteId, memoryUpdates);
                        }
                    })
                    .catch(error => {
                        logger.error('Error updating memory (non-blocking)', {
                            error: error.message,
                            athleteId
                        });
                    });
            }

            logger.info('Chat response generated', {
                athleteId,
                responseLength: response.length,
                conversationId: currentConversationId
            });

            return {
                answer: response,
                conversationId: currentConversationId,
                context: {
                    recentActivitiesCount: context.recentActivities.length,
                    relevantActivitiesCount: context.relevantActivities.length,
                    totalActivities: context.stats.totalActivities,
                    historyMessages: conversationHistory.length
                }
            };

        } catch (error) {
            logger.error('Error in chat', {
                athleteId,
                query: userQuery,
                error: error.message
            });
            throw error;
        }
    }

    /**
     * Store conversation in database
     */
    async storeConversation(athleteId, userMessage, assistantMessage, context, conversationId) {
        const conversationEntries = [
            {
                athlete_id: athleteId,
                conversation_id: conversationId,
                message: userMessage,
                role: 'user',
                context_used: {
                    recentActivities: context.recentActivities.length,
                    relevantActivities: context.relevantActivities.length
                }
            },
            {
                athlete_id: athleteId,
                conversation_id: conversationId,
                message: assistantMessage,
                role: 'assistant',
                context_used: null
            }
        ];

        const { error } = await this.db.supabase
            .from('chat_conversations')
            .insert(conversationEntries);

        if (error) {
            logger.error('Error storing conversation', {
                error: error.message,
                conversationId
            });
            // Don't throw - conversation storage failure shouldn't break the chat
        }
    }

    /**
     * Get chat history for an athlete
     */
    async getHistory(athleteId, limit = 20) {
        const { data, error } = await this.db.supabase
            .from('chat_conversations')
            .select('*')
            .eq('athlete_id', athleteId)
            .order('timestamp', { ascending: false })
            .limit(limit);

        if (error) {
            throw new Error(`Error fetching history: ${error.message}`);
        }

        return data || [];
    }
}

module.exports = ChatService;
