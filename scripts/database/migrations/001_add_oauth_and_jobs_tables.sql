-- Migration: Add OAuth tokens and sync jobs tables
-- Purpose: Enable multi-user OAuth token storage and async job tracking for Cloud Run service
-- Created: 2025-11-26

-- ============================================================================
-- OAuth Tokens Table
-- ============================================================================
-- Stores OAuth access and refresh tokens per athlete for Strava API access

CREATE TABLE IF NOT EXISTS oauth_tokens (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    athlete_id BIGINT NOT NULL UNIQUE REFERENCES athletes(id) ON DELETE CASCADE,
    access_token TEXT NOT NULL,
    refresh_token TEXT NOT NULL,
    token_type VARCHAR(20) DEFAULT 'Bearer',
    expires_at TIMESTAMPTZ NOT NULL,
    scope TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_oauth_tokens_athlete_id ON oauth_tokens(athlete_id);
CREATE INDEX IF NOT EXISTS idx_oauth_tokens_expires_at ON oauth_tokens(expires_at);

COMMENT ON TABLE oauth_tokens IS 'OAuth tokens for Strava API access per athlete';
COMMENT ON COLUMN oauth_tokens.athlete_id IS 'References athletes.id - the Strava athlete ID';
COMMENT ON COLUMN oauth_tokens.expires_at IS 'Token expiration timestamp for automatic refresh detection';

-- ============================================================================
-- Sync Jobs Table
-- ============================================================================
-- Tracks async sync jobs for activity data imports from Strava API

CREATE TABLE IF NOT EXISTS sync_jobs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    athlete_id BIGINT NOT NULL REFERENCES athletes(id) ON DELETE CASCADE,
    status VARCHAR(20) NOT NULL DEFAULT 'queued',
    sync_type VARCHAR(20) DEFAULT 'incremental',

    -- Timing
    created_at TIMESTAMPTZ DEFAULT NOW(),
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,

    -- Progress tracking
    total_activities INTEGER DEFAULT 0,
    processed_activities INTEGER DEFAULT 0,
    failed_activities INTEGER DEFAULT 0,

    -- Filtering parameters
    after_date TIMESTAMPTZ,
    before_date TIMESTAMPTZ,

    -- Error tracking
    error_message TEXT,
    error_stack TEXT,

    -- Metadata for checkpointing and resumption
    metadata JSONB,

    -- Constraints
    CONSTRAINT valid_status CHECK (status IN ('queued', 'processing', 'completed', 'failed')),
    CONSTRAINT valid_sync_type CHECK (sync_type IN ('full', 'incremental'))
);

CREATE INDEX IF NOT EXISTS idx_sync_jobs_athlete_id ON sync_jobs(athlete_id);
CREATE INDEX IF NOT EXISTS idx_sync_jobs_status ON sync_jobs(status);
CREATE INDEX IF NOT EXISTS idx_sync_jobs_created_at ON sync_jobs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_sync_jobs_status_created ON sync_jobs(status, created_at) WHERE status = 'queued';

COMMENT ON TABLE sync_jobs IS 'Async job queue for Strava activity sync operations';
COMMENT ON COLUMN sync_jobs.status IS 'Job status: queued, processing, completed, or failed';
COMMENT ON COLUMN sync_jobs.sync_type IS 'full = all activities, incremental = only new since after_date';
COMMENT ON COLUMN sync_jobs.metadata IS 'JSONB field for checkpointing (last_processed_page, execution_count, etc.)';

-- ============================================================================
-- Modify Athletes Table
-- ============================================================================
-- Add sync tracking fields to athletes table

ALTER TABLE athletes ADD COLUMN IF NOT EXISTS last_sync_at TIMESTAMPTZ;
ALTER TABLE athletes ADD COLUMN IF NOT EXISTS last_successful_sync_at TIMESTAMPTZ;
ALTER TABLE athletes ADD COLUMN IF NOT EXISTS total_syncs INTEGER DEFAULT 0;

COMMENT ON COLUMN athletes.last_sync_at IS 'Timestamp of most recent sync attempt (successful or failed)';
COMMENT ON COLUMN athletes.last_successful_sync_at IS 'Timestamp of most recent successful sync completion';
COMMENT ON COLUMN athletes.total_syncs IS 'Total number of sync jobs completed for this athlete';

-- ============================================================================
-- Migration Complete
-- ============================================================================

-- Verify tables created successfully
DO $$
BEGIN
    ASSERT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'oauth_tokens'),
        'oauth_tokens table was not created';
    ASSERT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'sync_jobs'),
        'sync_jobs table was not created';
    RAISE NOTICE 'Migration 001_add_oauth_and_jobs_tables completed successfully';
END $$;
