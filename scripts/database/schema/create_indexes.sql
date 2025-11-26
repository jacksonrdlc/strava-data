-- Runaway Labs Database Indexes and Constraints
-- Performance optimization for common query patterns

-- =============================================================================
-- PRIMARY PERFORMANCE INDEXES
-- =============================================================================

-- Activities table indexes (most queried table)
CREATE INDEX IF NOT EXISTS idx_activities_athlete_id ON activities(athlete_id);
CREATE INDEX IF NOT EXISTS idx_activities_date ON activities(activity_date);
CREATE INDEX IF NOT EXISTS idx_activities_type ON activities(activity_type_id);
CREATE INDEX IF NOT EXISTS idx_activities_distance ON activities(distance) WHERE distance IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_activities_elapsed_time ON activities(elapsed_time) WHERE elapsed_time IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_activities_gear ON activities(gear_id) WHERE gear_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_activities_commute ON activities(commute) WHERE commute = true;
CREATE INDEX IF NOT EXISTS idx_activities_flagged ON activities(flagged) WHERE flagged = true;

-- Composite indexes for common query patterns
CREATE INDEX IF NOT EXISTS idx_activities_athlete_date ON activities(athlete_id, activity_date DESC);
CREATE INDEX IF NOT EXISTS idx_activities_athlete_type ON activities(athlete_id, activity_type_id);
CREATE INDEX IF NOT EXISTS idx_activities_date_type ON activities(activity_date, activity_type_id);
CREATE INDEX IF NOT EXISTS idx_activities_athlete_gear ON activities(athlete_id, gear_id) WHERE gear_id IS NOT NULL;

-- =============================================================================
-- SOCIAL RELATIONSHIP INDEXES
-- =============================================================================

-- Follows table
CREATE INDEX IF NOT EXISTS idx_follows_follower ON follows(follower_id);
CREATE INDEX IF NOT EXISTS idx_follows_following ON follows(following_id);
CREATE INDEX IF NOT EXISTS idx_follows_favorite ON follows(follower_id, is_favorite) WHERE is_favorite = true;

-- Comments
CREATE INDEX IF NOT EXISTS idx_comments_activity ON comments(activity_id);
CREATE INDEX IF NOT EXISTS idx_comments_athlete ON comments(athlete_id);
CREATE INDEX IF NOT EXISTS idx_comments_date ON comments(comment_date DESC);

-- Reactions
CREATE INDEX IF NOT EXISTS idx_reactions_parent ON reactions(parent_type, parent_id);
CREATE INDEX IF NOT EXISTS idx_reactions_athlete ON reactions(athlete_id);
CREATE INDEX IF NOT EXISTS idx_reactions_date ON reactions(reaction_date DESC);

-- =============================================================================
-- GEAR AND EQUIPMENT INDEXES
-- =============================================================================

-- Gear
CREATE INDEX IF NOT EXISTS idx_gear_athlete ON gear(athlete_id);
CREATE INDEX IF NOT EXISTS idx_gear_type ON gear(gear_type);
CREATE INDEX IF NOT EXISTS idx_gear_brand ON gear(brand_id);
CREATE INDEX IF NOT EXISTS idx_gear_primary ON gear(athlete_id, is_primary) WHERE is_primary = true;

-- Brands and Models
CREATE INDEX IF NOT EXISTS idx_models_brand ON models(brand_id);

-- =============================================================================
-- GEOGRAPHIC INDEXES
-- =============================================================================

-- Routes
CREATE INDEX IF NOT EXISTS idx_routes_athlete ON routes(athlete_id);
CREATE INDEX IF NOT EXISTS idx_routes_name ON routes(name);

-- Segments
CREATE INDEX IF NOT EXISTS idx_segments_activity ON segments(activity_id);
CREATE INDEX IF NOT EXISTS idx_segments_location ON segments(start_latitude, start_longitude);

-- Starred content
CREATE INDEX IF NOT EXISTS idx_starred_routes_athlete ON starred_routes(athlete_id);
CREATE INDEX IF NOT EXISTS idx_starred_segments_athlete ON starred_segments(athlete_id);

-- =============================================================================
-- CHALLENGE AND GOAL INDEXES
-- =============================================================================

-- Goals
CREATE INDEX IF NOT EXISTS idx_goals_athlete ON goals(athlete_id);
CREATE INDEX IF NOT EXISTS idx_goals_type ON goals(goal_type);
CREATE INDEX IF NOT EXISTS idx_goals_active ON goals(athlete_id, completed) WHERE completed = false;
CREATE INDEX IF NOT EXISTS idx_goals_date_range ON goals(start_date, end_date);

-- Challenge Participations
CREATE INDEX IF NOT EXISTS idx_challenge_participations_athlete ON challenge_participations(athlete_id);
CREATE INDEX IF NOT EXISTS idx_challenge_participations_challenge ON challenge_participations(challenge_id);
CREATE INDEX IF NOT EXISTS idx_challenge_participations_completed ON challenge_participations(completed, completion_date);

-- =============================================================================
-- CLUB AND MEMBERSHIP INDEXES
-- =============================================================================

-- Memberships
CREATE INDEX IF NOT EXISTS idx_memberships_athlete ON memberships(athlete_id);
CREATE INDEX IF NOT EXISTS idx_memberships_club ON memberships(club_id);
CREATE INDEX IF NOT EXISTS idx_memberships_active ON memberships(status) WHERE status = 'active';

-- =============================================================================
-- SYSTEM AND AUDIT INDEXES
-- =============================================================================

-- Logins
CREATE INDEX IF NOT EXISTS idx_logins_athlete ON logins(athlete_id);
CREATE INDEX IF NOT EXISTS idx_logins_datetime ON logins(login_datetime DESC);
CREATE INDEX IF NOT EXISTS idx_logins_ip ON logins(ip_address);

-- Connected Apps
CREATE INDEX IF NOT EXISTS idx_connected_apps_athlete ON connected_apps(athlete_id);
CREATE INDEX IF NOT EXISTS idx_connected_apps_enabled ON connected_apps(enabled) WHERE enabled = true;

-- Media
CREATE INDEX IF NOT EXISTS idx_media_activity ON media(activity_id);
CREATE INDEX IF NOT EXISTS idx_media_athlete ON media(athlete_id);

-- =============================================================================
-- FULL TEXT SEARCH INDEXES (PostgreSQL)
-- =============================================================================

-- Activity names and descriptions
CREATE INDEX IF NOT EXISTS idx_activities_name_fts ON activities USING gin(to_tsvector('english', name)) WHERE name IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_activities_description_fts ON activities USING gin(to_tsvector('english', description)) WHERE description IS NOT NULL;

-- Route names
CREATE INDEX IF NOT EXISTS idx_routes_name_fts ON routes USING gin(to_tsvector('english', name)) WHERE name IS NOT NULL;

-- =============================================================================
-- CONSTRAINTS AND FOREIGN KEYS
-- =============================================================================

-- Additional foreign key constraints
ALTER TABLE activities ADD CONSTRAINT fk_activities_athlete
    FOREIGN KEY (athlete_id) REFERENCES athletes(id) ON DELETE CASCADE;

ALTER TABLE activities ADD CONSTRAINT fk_activities_gear
    FOREIGN KEY (gear_id) REFERENCES gear(id) ON DELETE SET NULL;

ALTER TABLE gear ADD CONSTRAINT fk_gear_athlete
    FOREIGN KEY (athlete_id) REFERENCES athletes(id) ON DELETE CASCADE;

-- Check constraints
ALTER TABLE activities ADD CONSTRAINT chk_elapsed_time_positive
    CHECK (elapsed_time IS NULL OR elapsed_time > 0);

ALTER TABLE activities ADD CONSTRAINT chk_distance_positive
    CHECK (distance IS NULL OR distance >= 0);

ALTER TABLE activities ADD CONSTRAINT chk_heart_rate_valid
    CHECK (max_heart_rate IS NULL OR (max_heart_rate > 0 AND max_heart_rate < 300));

ALTER TABLE activities ADD CONSTRAINT chk_average_hr_max_hr
    CHECK (average_heart_rate IS NULL OR max_heart_rate IS NULL OR average_heart_rate <= max_heart_rate);

-- =============================================================================
-- PARTITIONING (for large datasets)
-- =============================================================================

-- Consider partitioning activities table by date for very large datasets
-- This would require recreating the table with partitioning enabled:

/*
-- Example monthly partitioning for activities (PostgreSQL 10+)
CREATE TABLE activities_partitioned (
    -- same columns as activities
) PARTITION BY RANGE (activity_date);

-- Create monthly partitions
CREATE TABLE activities_2023_01 PARTITION OF activities_partitioned
    FOR VALUES FROM ('2023-01-01') TO ('2023-02-01');

CREATE TABLE activities_2023_02 PARTITION OF activities_partitioned
    FOR VALUES FROM ('2023-02-01') TO ('2023-03-01');
-- etc.
*/