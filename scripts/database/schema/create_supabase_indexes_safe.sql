-- Runaway Labs - Supabase Database Indexes (Safe Version)
-- Optimized for Supabase with only guaranteed compatible indexes

-- =============================================================================
-- PRIMARY PERFORMANCE INDEXES
-- =============================================================================

-- Activities table indexes (most queried table)
CREATE INDEX IF NOT EXISTS idx_activities_athlete_id ON activities(athlete_id);
CREATE INDEX IF NOT EXISTS idx_activities_date ON activities(activity_date DESC);
CREATE INDEX IF NOT EXISTS idx_activities_type ON activities(activity_type_id) WHERE activity_type_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_activities_distance ON activities(distance DESC) WHERE distance IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_activities_elapsed_time ON activities(elapsed_time DESC) WHERE elapsed_time IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_activities_gear ON activities(gear_id) WHERE gear_id IS NOT NULL;

-- Partial indexes for boolean flags
CREATE INDEX IF NOT EXISTS idx_activities_commute ON activities(athlete_id, activity_date) WHERE commute = true;
CREATE INDEX IF NOT EXISTS idx_activities_flagged ON activities(athlete_id, activity_date) WHERE flagged = true;
CREATE INDEX IF NOT EXISTS idx_activities_private ON activities(athlete_id, activity_date) WHERE private = true;

-- Composite indexes for common query patterns
CREATE INDEX IF NOT EXISTS idx_activities_athlete_date ON activities(athlete_id, activity_date DESC);
CREATE INDEX IF NOT EXISTS idx_activities_athlete_type ON activities(athlete_id, activity_type_id);
CREATE INDEX IF NOT EXISTS idx_activities_date_type ON activities(activity_date DESC, activity_type_id);

-- Performance metrics indexes
CREATE INDEX IF NOT EXISTS idx_activities_performance ON activities(athlete_id, distance DESC, elapsed_time ASC) WHERE distance IS NOT NULL AND elapsed_time IS NOT NULL;

-- =============================================================================
-- SOCIAL RELATIONSHIP INDEXES
-- =============================================================================

-- Follows table
CREATE INDEX IF NOT EXISTS idx_follows_follower ON follows(follower_id);
CREATE INDEX IF NOT EXISTS idx_follows_following ON follows(following_id);
CREATE INDEX IF NOT EXISTS idx_follows_mutual ON follows(follower_id, following_id);

-- Comments
CREATE INDEX IF NOT EXISTS idx_comments_activity ON comments(activity_id, comment_date DESC);
CREATE INDEX IF NOT EXISTS idx_comments_athlete ON comments(athlete_id, comment_date DESC);

-- Reactions
CREATE INDEX IF NOT EXISTS idx_reactions_parent ON reactions(parent_type, parent_id, reaction_date DESC);
CREATE INDEX IF NOT EXISTS idx_reactions_athlete ON reactions(athlete_id, reaction_date DESC);

-- =============================================================================
-- GEAR AND EQUIPMENT INDEXES
-- =============================================================================

-- Gear
CREATE INDEX IF NOT EXISTS idx_gear_athlete ON gear(athlete_id, gear_type);
CREATE INDEX IF NOT EXISTS idx_gear_brand ON gear(brand_id) WHERE brand_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_gear_usage ON gear(athlete_id, total_distance DESC) WHERE total_distance > 0;

-- Brands and Models (for search)
CREATE INDEX IF NOT EXISTS idx_brands_name ON brands(name);
CREATE INDEX IF NOT EXISTS idx_models_brand_name ON models(brand_id, name);

-- =============================================================================
-- GEOGRAPHIC INDEXES
-- =============================================================================

-- Routes
CREATE INDEX IF NOT EXISTS idx_routes_athlete ON routes(athlete_id, created_at DESC);

-- Segments
CREATE INDEX IF NOT EXISTS idx_segments_activity ON segments(activity_id);
CREATE INDEX IF NOT EXISTS idx_segments_location ON segments(start_latitude, start_longitude);

-- Starred content
CREATE INDEX IF NOT EXISTS idx_starred_routes_athlete ON starred_routes(athlete_id, starred_at DESC);
CREATE INDEX IF NOT EXISTS idx_starred_segments_athlete ON starred_segments(athlete_id, starred_at DESC);

-- =============================================================================
-- CHALLENGE AND GOAL INDEXES
-- =============================================================================

-- Goals
CREATE INDEX IF NOT EXISTS idx_goals_athlete ON goals(athlete_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_goals_active ON goals(athlete_id, start_date, end_date) WHERE completed = false;

-- Challenge Participations
CREATE INDEX IF NOT EXISTS idx_challenge_participations_athlete ON challenge_participations(athlete_id, join_date DESC);
CREATE INDEX IF NOT EXISTS idx_challenge_participations_challenge ON challenge_participations(challenge_id, join_date DESC);

-- =============================================================================
-- CLUB AND MEMBERSHIP INDEXES
-- =============================================================================

-- Memberships
CREATE INDEX IF NOT EXISTS idx_memberships_athlete ON memberships(athlete_id, join_date DESC);
CREATE INDEX IF NOT EXISTS idx_memberships_club ON memberships(club_id, join_date DESC) WHERE status = 'active';

-- =============================================================================
-- SYSTEM AND AUDIT INDEXES
-- =============================================================================

-- Logins for security analysis
CREATE INDEX IF NOT EXISTS idx_logins_athlete ON logins(athlete_id, login_datetime DESC);
CREATE INDEX IF NOT EXISTS idx_logins_ip ON logins(ip_address, login_datetime DESC);

-- Connected Apps
CREATE INDEX IF NOT EXISTS idx_connected_apps_athlete ON connected_apps(athlete_id) WHERE enabled = true;

-- Media
CREATE INDEX IF NOT EXISTS idx_media_activity ON media(activity_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_media_athlete ON media(athlete_id, created_at DESC);

-- =============================================================================
-- BASIC TEXT SEARCH INDEXES
-- =============================================================================

-- Simple text indexes (avoiding complex expressions)
CREATE INDEX IF NOT EXISTS idx_activities_name_text ON activities(name) WHERE name IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_routes_name_text ON routes(name) WHERE name IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_clubs_name_text ON clubs(name);

-- =============================================================================
-- ANALYTICS INDEXES (SAFE VERSIONS)
-- =============================================================================

-- Basic date-based indexes (simplified)
CREATE INDEX IF NOT EXISTS idx_activities_type_analytics ON activities(athlete_id, activity_type_id, activity_date) WHERE activity_type_id IS NOT NULL;

-- Distance and time analytics
CREATE INDEX IF NOT EXISTS idx_activities_distance_time ON activities(athlete_id, distance, elapsed_time) WHERE distance IS NOT NULL AND elapsed_time IS NOT NULL;

-- =============================================================================
-- MAINTENANCE FUNCTIONS
-- =============================================================================

-- Create function to analyze table statistics
CREATE OR REPLACE FUNCTION analyze_all_tables()
RETURNS void AS $$
DECLARE
    table_name text;
BEGIN
    FOR table_name IN
        SELECT tablename FROM pg_tables
        WHERE schemaname = 'public'
        AND tablename NOT LIKE 'pg_%'
    LOOP
        EXECUTE 'ANALYZE ' || quote_ident(table_name);
    END LOOP;
END;
$$ LANGUAGE plpgsql;

-- Function to get index usage statistics
CREATE OR REPLACE FUNCTION get_index_usage()
RETURNS TABLE(
    schemaname text,
    tablename text,
    indexname text,
    idx_scan bigint,
    idx_tup_read bigint,
    idx_tup_fetch bigint
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        s.schemaname::text,
        s.relname::text,
        s.indexrelname::text,
        s.idx_scan,
        s.idx_tup_read,
        s.idx_tup_fetch
    FROM pg_stat_user_indexes s
    WHERE s.schemaname = 'public'
    ORDER BY s.idx_scan DESC;
END;
$$ LANGUAGE plpgsql;