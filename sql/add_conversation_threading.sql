-- Migration: Add conversation threading support
-- Date: 2025-12-01
-- Purpose: Enable multi-turn conversations with context

-- Add conversation_id column to group related messages
ALTER TABLE chat_conversations
ADD COLUMN conversation_id UUID;

-- Add index for faster conversation lookups
CREATE INDEX idx_chat_conversations_conversation_id
ON chat_conversations(conversation_id);

-- Add index for athlete + conversation lookups
CREATE INDEX idx_chat_conversations_athlete_conversation
ON chat_conversations(athlete_id, conversation_id);

-- Add index for recent conversations per athlete
CREATE INDEX idx_chat_conversations_athlete_timestamp
ON chat_conversations(athlete_id, timestamp DESC);

-- Optional: Add a summary field for conversation titles (for future UI)
ALTER TABLE chat_conversations
ADD COLUMN conversation_summary TEXT;

-- Create a view for easy conversation listing
CREATE OR REPLACE VIEW conversation_summaries AS
SELECT
    athlete_id,
    conversation_id,
    MIN(timestamp) as started_at,
    MAX(timestamp) as last_message_at,
    COUNT(*) as message_count,
    MAX(CASE WHEN role = 'user' THEN message ELSE NULL END) as last_user_message
FROM chat_conversations
WHERE conversation_id IS NOT NULL
GROUP BY athlete_id, conversation_id
ORDER BY last_message_at DESC;

COMMENT ON VIEW conversation_summaries IS 'Summary of all conversations for easy listing in UI';
