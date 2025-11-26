-- Runaway Labs - Supabase Database Indexes (Minimal Safe Version)
-- Only the most essential indexes that are guaranteed to work

-- =============================================================================
-- CORE PERFORMANCE INDEXES
-- =============================================================================

-- Activities table - most critical indexes
CREATE INDEX IF NOT EXISTS idx_activities_athlete_id ON activities(athlete_id);
CREATE INDEX IF NOT EXISTS idx_activities_date ON activities(activity_date DESC);
CREATE INDEX IF NOT EXISTS idx_activities_type ON activities(activity_type_id);
CREATE INDEX IF NOT EXISTS idx_activities_distance ON activities(distance DESC);
CREATE INDEX IF NOT EXISTS idx_activities_elapsed_time ON activities(elapsed_time);
CREATE INDEX IF NOT EXISTS idx_activities_gear ON activities(gear_id);

-- Composite indexes for common queries
CREATE INDEX IF NOT EXISTS idx_activities_athlete_date ON activities(athlete_id, activity_date DESC);
CREATE INDEX IF NOT EXISTS idx_activities_athlete_type ON activities(athlete_id, activity_type_id);

-- =============================================================================
-- SOCIAL INDEXES
-- =============================================================================

-- Follows
CREATE INDEX IF NOT EXISTS idx_follows_follower ON follows(follower_id);
CREATE INDEX IF NOT EXISTS idx_follows_following ON follows(following_id);

-- Comments
CREATE INDEX IF NOT EXISTS idx_comments_activity ON comments(activity_id);
CREATE INDEX IF NOT EXISTS idx_comments_athlete ON comments(athlete_id);

-- Reactions
CREATE INDEX IF NOT EXISTS idx_reactions_parent ON reactions(parent_type, parent_id);
CREATE INDEX IF NOT EXISTS idx_reactions_athlete ON reactions(athlete_id);

-- =============================================================================
-- GEAR AND REFERENCE INDEXES
-- =============================================================================

-- Gear
CREATE INDEX IF NOT EXISTS idx_gear_athlete ON gear(athlete_id);
CREATE INDEX IF NOT EXISTS idx_gear_type ON gear(gear_type);

-- Reference tables
CREATE INDEX IF NOT EXISTS idx_brands_name ON brands(name);
CREATE INDEX IF NOT EXISTS idx_models_brand ON models(brand_id);

-- =============================================================================
-- GEOGRAPHIC INDEXES
-- =============================================================================

-- Routes
CREATE INDEX IF NOT EXISTS idx_routes_athlete ON routes(athlete_id);

-- Segments
CREATE INDEX IF NOT EXISTS idx_segments_activity ON segments(activity_id);

-- =============================================================================
-- MEMBERSHIP AND PARTICIPATION INDEXES
-- =============================================================================

-- Club memberships
CREATE INDEX IF NOT EXISTS idx_memberships_athlete ON memberships(athlete_id);
CREATE INDEX IF NOT EXISTS idx_memberships_club ON memberships(club_id);

-- Challenge participations
CREATE INDEX IF NOT EXISTS idx_challenge_participations_athlete ON challenge_participations(athlete_id);
CREATE INDEX IF NOT EXISTS idx_challenge_participations_challenge ON challenge_participations(challenge_id);

-- Goals
CREATE INDEX IF NOT EXISTS idx_goals_athlete ON goals(athlete_id);

-- =============================================================================
-- SYSTEM INDEXES
-- =============================================================================

-- Media
CREATE INDEX IF NOT EXISTS idx_media_activity ON media(activity_id);
CREATE INDEX IF NOT EXISTS idx_media_athlete ON media(athlete_id);

-- Connected Apps
CREATE INDEX IF NOT EXISTS idx_connected_apps_athlete ON connected_apps(athlete_id);

-- Logins
CREATE INDEX IF NOT EXISTS idx_logins_athlete ON logins(athlete_id);

-- =============================================================================
-- SIMPLE TEXT SEARCH
-- =============================================================================

-- Basic text indexes (no functions)
CREATE INDEX IF NOT EXISTS idx_activities_name ON activities(name);
CREATE INDEX IF NOT EXISTS idx_routes_name ON routes(name);
CREATE INDEX IF NOT EXISTS idx_clubs_name ON clubs(name);