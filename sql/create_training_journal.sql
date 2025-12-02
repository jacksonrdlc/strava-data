-- Migration: Create training journal table
-- Date: 2025-12-01
-- Purpose: Store weekly AI-generated training summaries and insights

-- Create training_journal table
CREATE TABLE IF NOT EXISTS training_journal (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    athlete_id BIGINT NOT NULL,

    -- Time period covered
    week_start_date DATE NOT NULL,
    week_end_date DATE NOT NULL,

    -- Generated narrative content
    narrative TEXT NOT NULL,

    -- Week statistics
    week_stats JSONB DEFAULT '{}',
    -- Example structure:
    -- {
    --   "total_distance": 35.2,
    --   "total_time": 18000,
    --   "activities_count": 5,
    --   "avg_pace": "10:30",
    --   "longest_run": 13.1,
    --   "elevation_gain": 1200
    -- }

    -- Key insights extracted
    insights JSONB DEFAULT '[]',
    -- Example structure:
    -- [
    --   {"type": "achievement", "text": "Hit new mileage PR this week"},
    --   {"type": "pattern", "text": "Running consistently on weekdays"},
    --   {"type": "recommendation", "text": "Consider adding a recovery day"}
    -- ]

    -- Progress towards goals
    goal_progress JSONB DEFAULT '{}',
    -- Example structure:
    -- {
    --   "marathon_training": {
    --     "target_weekly_mileage": 45,
    --     "actual_mileage": 38,
    --     "percentage": 84
    --   }
    -- }

    -- Metadata
    generation_model VARCHAR(100),
    generation_timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

    -- Constraints
    UNIQUE(athlete_id, week_start_date)
);

-- Create indexes for efficient queries
CREATE INDEX idx_training_journal_athlete_id
ON training_journal(athlete_id);

CREATE INDEX idx_training_journal_athlete_date
ON training_journal(athlete_id, week_start_date DESC);

CREATE INDEX idx_training_journal_generation_timestamp
ON training_journal(generation_timestamp DESC);

-- Create a view for recent journal entries
CREATE OR REPLACE VIEW recent_journal_entries AS
SELECT
    athlete_id,
    week_start_date,
    week_end_date,
    narrative,
    week_stats,
    insights,
    generation_timestamp
FROM training_journal
ORDER BY week_start_date DESC;

-- Add comment
COMMENT ON TABLE training_journal IS 'Weekly AI-generated training summaries and insights for athletes';
COMMENT ON COLUMN training_journal.narrative IS 'Human-readable weekly summary written by AI coach';
COMMENT ON COLUMN training_journal.week_stats IS 'Aggregated statistics for the week';
COMMENT ON COLUMN training_journal.insights IS 'Key patterns, achievements, and recommendations';
