// MemoryService.js
// Extracts and manages persistent athlete memory from conversations

const logger = require('../utils/logger');

class MemoryService {
    constructor(databaseClient, anthropicApiKey) {
        if (!databaseClient) {
            throw new Error('DatabaseClient is required');
        }
        if (!anthropicApiKey) {
            throw new Error('Anthropic API key is required');
        }

        this.db = databaseClient;
        this.anthropicApiKey = anthropicApiKey;
        this.model = 'claude-3-opus-20240229'; // Use same model as ChatService
        this.maxTokens = 2048;
    }

    /**
     * Extract memory updates from a conversation
     */
    async extractMemoryFromConversation(athleteId, userMessage, assistantResponse, context) {
        logger.info('Extracting memory from conversation', {
            athleteId,
            userMessageLength: userMessage.length,
            responseLength: assistantResponse.length
        });

        try {
            // Build memory extraction prompt
            const prompt = this.buildMemoryExtractionPrompt(userMessage, assistantResponse, context);

            // Call Claude to extract memory
            const memoryUpdate = await this.callClaude(prompt);

            // Parse the response
            let parsedUpdate;
            try {
                // Extract JSON from response (Claude might wrap it in markdown)
                const jsonMatch = memoryUpdate.match(/\{[\s\S]*\}/);
                if (jsonMatch) {
                    parsedUpdate = JSON.parse(jsonMatch[0]);
                } else {
                    parsedUpdate = JSON.parse(memoryUpdate);
                }
            } catch (parseError) {
                logger.warn('Failed to parse memory update', {
                    error: parseError.message,
                    response: memoryUpdate
                });
                return null;
            }

            logger.info('Memory extracted successfully', {
                athleteId,
                updatedSections: Object.keys(parsedUpdate)
            });

            return parsedUpdate;

        } catch (error) {
            logger.error('Error extracting memory', {
                error: error.message,
                athleteId
            });
            return null;
        }
    }

    /**
     * Build prompt for memory extraction
     */
    buildMemoryExtractionPrompt(userMessage, assistantResponse, context) {
        const parts = [];

        parts.push('You are a memory extraction system. Your job is to analyze a conversation between a runner and their AI coach, and extract any new information that should be remembered about the athlete.');
        parts.push('');
        parts.push('CONVERSATION:');
        parts.push(`ATHLETE: ${userMessage}`);
        parts.push(`COACH: ${assistantResponse}`);
        parts.push('');

        if (context.recentActivities && context.recentActivities.length > 0) {
            parts.push('RECENT ACTIVITY CONTEXT:');
            parts.push(`- ${context.recentActivities.length} recent activities`);
            parts.push(`- Total activities: ${context.stats.totalActivities || 0}`);
            parts.push('');
        }

        parts.push('INSTRUCTIONS:');
        parts.push('Extract any new information about the athlete that should be remembered. Return ONLY a JSON object with updates. Only include sections that have new information.');
        parts.push('');
        parts.push('Available memory sections:');
        parts.push('- personal: name, age_range, experience_level');
        parts.push('- goals: primary goal, secondary goals, race schedule');
        parts.push('- training_preferences: coaching style, preferred days, workout time');
        parts.push('- physical_profile: injuries, concerns, strengths, areas to improve');
        parts.push('- key_conversation: date, topic, key_points (for important discussions)');
        parts.push('');
        parts.push('Example output:');
        parts.push('{');
        parts.push('  "goals": {');
        parts.push('    "primary": "Complete a marathon under 4 hours"');
        parts.push('  },');
        parts.push('  "key_conversation": {');
        parts.push('    "date": "2025-12-01",');
        parts.push('    "topic": "Marathon training goals",');
        parts.push('    "key_points": ["Aiming for sub-4 marathon", "Currently building base"]');
        parts.push('  }');
        parts.push('}');
        parts.push('');
        parts.push('If there is no significant new information to remember, return an empty object: {}');
        parts.push('');
        parts.push('Return only valid JSON, no other text:');

        return parts.join('\n');
    }

    /**
     * Merge memory update into existing memory
     */
    mergeMemoryUpdate(existingMemory, updates) {
        if (!updates || Object.keys(updates).length === 0) {
            return existingMemory;
        }

        const merged = { ...existingMemory };

        // Merge each section
        for (const [section, data] of Object.entries(updates)) {
            if (section === 'key_conversation') {
                // Add to key_conversations array
                if (!merged.key_conversations) {
                    merged.key_conversations = [];
                }
                merged.key_conversations.unshift(data); // Add to beginning
                // Keep only last 20 conversations
                if (merged.key_conversations.length > 20) {
                    merged.key_conversations = merged.key_conversations.slice(0, 20);
                }
            } else {
                // Merge object properties
                if (!merged[section]) {
                    merged[section] = {};
                }
                merged[section] = {
                    ...merged[section],
                    ...data
                };
            }
        }

        // Update timestamp
        merged.updated_at = new Date().toISOString();

        return merged;
    }

    /**
     * Update athlete memory in database
     */
    async updateAthleteMemory(athleteId, memoryUpdates) {
        if (!memoryUpdates || Object.keys(memoryUpdates).length === 0) {
            logger.info('No memory updates to save', { athleteId });
            return null;
        }

        logger.info('Updating athlete memory', {
            athleteId,
            sections: Object.keys(memoryUpdates)
        });

        try {
            // Get current profile
            const { data: profile, error: fetchError } = await this.db.supabase
                .from('athlete_ai_profiles')
                .select('*')
                .eq('athlete_id', athleteId)
                .single();

            if (fetchError && fetchError.code !== 'PGRST116') {
                throw new Error(`Error fetching profile: ${fetchError.message}`);
            }

            // Get existing memory or create new structure
            const existingMemory = profile?.core_memory || {
                athlete_id: athleteId,
                created_at: new Date().toISOString(),
                preferences: {
                    coaching_style: 'supportive',
                    verbosity: 'concise'
                }
            };

            // Merge updates
            const updatedMemory = this.mergeMemoryUpdate(existingMemory, memoryUpdates);

            // Save to database
            if (profile) {
                // Update existing profile
                const { error: updateError } = await this.db.supabase
                    .from('athlete_ai_profiles')
                    .update({ core_memory: updatedMemory })
                    .eq('athlete_id', athleteId);

                if (updateError) {
                    throw new Error(`Error updating memory: ${updateError.message}`);
                }
            } else {
                // Create new profile
                const { error: createError } = await this.db.supabase
                    .from('athlete_ai_profiles')
                    .insert({
                        athlete_id: athleteId,
                        core_memory: updatedMemory,
                        preferences: {}
                    });

                if (createError) {
                    throw new Error(`Error creating profile: ${createError.message}`);
                }
            }

            logger.info('Memory updated successfully', {
                athleteId,
                memorySections: Object.keys(updatedMemory)
            });

            return updatedMemory;

        } catch (error) {
            logger.error('Error updating athlete memory', {
                error: error.message,
                athleteId
            });
            throw error;
        }
    }

    /**
     * Call Claude API for memory extraction
     */
    async callClaude(prompt) {
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
            return data.content[0].text;

        } catch (error) {
            logger.error('Error calling Claude API for memory extraction', {
                error: error.message
            });
            throw error;
        }
    }
}

module.exports = MemoryService;
