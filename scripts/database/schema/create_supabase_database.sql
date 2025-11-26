-- Runaway Labs - Supabase Compatible Database Schema
-- Created for Supabase PostgreSQL with RLS and security considerations

-- NOTE: Database creation is handled by Supabase - skip CREATE DATABASE
-- Enable necessary extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =============================================================================
-- REFERENCE/LOOKUP TABLES
-- =============================================================================

-- Activity Types
CREATE TABLE IF NOT EXISTS activity_types (
    id BIGSERIAL PRIMARY KEY,
    name VARCHAR(50) NOT NULL UNIQUE,
    category VARCHAR(30),
    description TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Brands (for gear)
CREATE TABLE IF NOT EXISTS brands (
    id BIGSERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL UNIQUE,
    description TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Models (for gear)
CREATE TABLE IF NOT EXISTS models (
    id BIGSERIAL PRIMARY KEY,
    brand_id BIGINT REFERENCES brands(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    category VARCHAR(50),
    description TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(brand_id, name)
);

-- =============================================================================
-- CORE USER TABLES
-- =============================================================================

-- Athletes (Users) - integrate with Supabase auth
CREATE TABLE IF NOT EXISTS athletes (
    id BIGINT PRIMARY KEY,
    auth_user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    email VARCHAR(255) UNIQUE,
    first_name VARCHAR(100),
    last_name VARCHAR(100),
    sex CHAR(1) CHECK (sex IN ('M', 'F', 'O')),
    description TEXT,
    weight DECIMAL(5,1), -- kg
    city VARCHAR(100),
    state VARCHAR(100),
    country VARCHAR(100),
    health_consent_status VARCHAR(50),
    health_consent_date TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================================================
-- GEAR TABLES
-- =============================================================================

-- Gear (Bikes, Shoes, etc.)
CREATE TABLE IF NOT EXISTS gear (
    id VARCHAR(100) PRIMARY KEY,
    athlete_id BIGINT NOT NULL REFERENCES athletes(id) ON DELETE CASCADE,
    brand_id BIGINT REFERENCES brands(id) ON DELETE SET NULL,
    model_id BIGINT REFERENCES models(id) ON DELETE SET NULL,
    gear_type VARCHAR(20) NOT NULL CHECK (gear_type IN ('bike', 'shoe', 'other')),
    name VARCHAR(200),
    is_primary BOOLEAN DEFAULT FALSE,
    total_distance BIGINT DEFAULT 0, -- meters
    retired BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================================================
-- ACTIVITY TABLES
-- =============================================================================

-- Activities (Main data table)
CREATE TABLE IF NOT EXISTS activities (
    id BIGINT PRIMARY KEY,
    athlete_id BIGINT NOT NULL REFERENCES athletes(id) ON DELETE CASCADE,
    activity_type_id BIGINT REFERENCES activity_types(id) ON DELETE SET NULL,
    name VARCHAR(500),
    description TEXT,

    -- Temporal data
    activity_date TIMESTAMPTZ NOT NULL,
    start_time TIMESTAMPTZ,

    -- Performance metrics
    elapsed_time INTEGER CHECK (elapsed_time > 0), -- seconds
    moving_time INTEGER CHECK (moving_time > 0), -- seconds
    timer_time INTEGER, -- seconds
    distance DECIMAL(12,2) CHECK (distance >= 0), -- meters

    -- Elevation data
    elevation_gain DECIMAL(8,1),
    elevation_loss DECIMAL(8,1),
    elevation_low DECIMAL(8,1),
    elevation_high DECIMAL(8,1),
    max_grade DECIMAL(5,1),
    average_grade DECIMAL(5,1),
    average_positive_grade DECIMAL(5,1),
    average_negative_grade DECIMAL(5,1),

    -- Speed data
    max_speed DECIMAL(6,3), -- m/s
    average_speed DECIMAL(6,3), -- m/s
    average_elapsed_speed DECIMAL(6,3),

    -- Heart rate data
    max_heart_rate INTEGER CHECK (max_heart_rate > 0 AND max_heart_rate < 300),
    average_heart_rate INTEGER CHECK (average_heart_rate > 0 AND average_heart_rate < 300),
    has_heartrate BOOLEAN DEFAULT FALSE,

    -- Power data
    max_watts INTEGER CHECK (max_watts > 0),
    average_watts INTEGER CHECK (average_watts > 0),
    weighted_average_watts INTEGER CHECK (weighted_average_watts > 0),
    device_watts BOOLEAN DEFAULT FALSE,
    total_work INTEGER, -- kilojoules

    -- Cadence data
    max_cadence INTEGER CHECK (max_cadence > 0),
    average_cadence INTEGER CHECK (average_cadence > 0),

    -- Environmental data
    calories INTEGER CHECK (calories > 0),
    max_temperature INTEGER,
    average_temperature INTEGER,
    weather_condition VARCHAR(100),
    humidity INTEGER CHECK (humidity >= 0 AND humidity <= 100),
    wind_speed DECIMAL(5,1) CHECK (wind_speed >= 0),
    wind_gust DECIMAL(5,1) CHECK (wind_gust >= 0),
    wind_bearing INTEGER CHECK (wind_bearing >= 0 AND wind_bearing <= 360),
    precipitation_intensity DECIMAL(5,3) CHECK (precipitation_intensity >= 0),
    precipitation_probability DECIMAL(3,2) CHECK (precipitation_probability >= 0 AND precipitation_probability <= 1),
    precipitation_type VARCHAR(50),
    cloud_cover DECIMAL(3,2) CHECK (cloud_cover >= 0 AND cloud_cover <= 1),
    weather_visibility DECIMAL(5,1) CHECK (weather_visibility >= 0),
    uv_index INTEGER CHECK (uv_index >= 0),
    weather_ozone INTEGER,
    weather_pressure DECIMAL(8,1) CHECK (weather_pressure > 0),
    apparent_temperature INTEGER,
    dewpoint INTEGER,

    -- Activity flags
    commute BOOLEAN DEFAULT FALSE,
    flagged BOOLEAN DEFAULT FALSE,
    with_pet BOOLEAN DEFAULT FALSE,
    competition BOOLEAN DEFAULT FALSE,
    long_run BOOLEAN DEFAULT FALSE,
    for_a_cause BOOLEAN DEFAULT FALSE,
    trainer BOOLEAN DEFAULT FALSE,
    manual BOOLEAN DEFAULT FALSE,
    private BOOLEAN DEFAULT FALSE,

    -- File references
    filename VARCHAR(500),

    -- Gear reference
    gear_id VARCHAR(100) REFERENCES gear(id) ON DELETE SET NULL,

    -- Additional metrics
    perceived_exertion INTEGER CHECK (perceived_exertion >= 1 AND perceived_exertion <= 10),
    relative_effort INTEGER CHECK (relative_effort >= 0),
    training_load INTEGER CHECK (training_load >= 0),
    intensity DECIMAL(5,2) CHECK (intensity >= 0),
    average_grade_adjusted_pace DECIMAL(8,3),
    grade_adjusted_distance DECIMAL(10,1) CHECK (grade_adjusted_distance >= 0),
    dirt_distance DECIMAL(10,1) CHECK (dirt_distance >= 0),
    newly_explored_distance DECIMAL(10,1) CHECK (newly_explored_distance >= 0),
    newly_explored_dirt_distance DECIMAL(10,1) CHECK (newly_explored_dirt_distance >= 0),
    total_steps INTEGER CHECK (total_steps > 0),
    carbon_saved DECIMAL(8,2) CHECK (carbon_saved >= 0),
    pool_length INTEGER CHECK (pool_length > 0),
    total_cycles INTEGER CHECK (total_cycles > 0),
    jump_count INTEGER CHECK (jump_count >= 0),
    total_grit DECIMAL(5,1) CHECK (total_grit >= 0),
    average_flow DECIMAL(5,1) CHECK (average_flow >= 0),

    -- Map data (encoded polylines from Strava)
    map_polyline TEXT, -- Full resolution encoded polyline
    map_summary_polyline TEXT, -- Simplified polyline for overview display

    -- Location data
    start_latitude DECIMAL(10, 7),
    start_longitude DECIMAL(10, 7),
    end_latitude DECIMAL(10, 7),
    end_longitude DECIMAL(10, 7),

    -- Metadata
    from_upload BOOLEAN DEFAULT FALSE,
    resource_state INTEGER DEFAULT 2,
    external_id VARCHAR(200),

    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================================================
-- GEOGRAPHIC TABLES
-- =============================================================================

-- Routes
CREATE TABLE IF NOT EXISTS routes (
    id BIGSERIAL PRIMARY KEY,
    athlete_id BIGINT NOT NULL REFERENCES athletes(id) ON DELETE CASCADE,
    name VARCHAR(500),
    filename VARCHAR(500),
    description TEXT,
    distance DECIMAL(12,2) CHECK (distance >= 0),
    elevation_gain DECIMAL(8,1),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Segments
CREATE TABLE IF NOT EXISTS segments (
    id BIGSERIAL PRIMARY KEY,
    activity_id BIGINT REFERENCES activities(id) ON DELETE CASCADE,
    name VARCHAR(500),
    start_latitude DECIMAL(10, 7),
    start_longitude DECIMAL(10, 7),
    end_latitude DECIMAL(10, 7),
    end_longitude DECIMAL(10, 7),
    distance DECIMAL(10,2) CHECK (distance >= 0),
    average_grade DECIMAL(5,1),
    maximum_grade DECIMAL(5,1),
    elevation_high DECIMAL(8,1),
    elevation_low DECIMAL(8,1),
    climb_category INTEGER,
    city VARCHAR(100),
    state VARCHAR(100),
    country VARCHAR(100),
    hazardous BOOLEAN DEFAULT FALSE,
    starred BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Starred Routes
CREATE TABLE IF NOT EXISTS starred_routes (
    athlete_id BIGINT REFERENCES athletes(id) ON DELETE CASCADE,
    route_id BIGINT REFERENCES routes(id) ON DELETE CASCADE,
    starred_at TIMESTAMPTZ DEFAULT NOW(),
    PRIMARY KEY (athlete_id, route_id)
);

-- Starred Segments
CREATE TABLE IF NOT EXISTS starred_segments (
    athlete_id BIGINT REFERENCES athletes(id) ON DELETE CASCADE,
    segment_id BIGINT REFERENCES segments(id) ON DELETE CASCADE,
    starred_at TIMESTAMPTZ DEFAULT NOW(),
    PRIMARY KEY (athlete_id, segment_id)
);

-- =============================================================================
-- SOCIAL TABLES
-- =============================================================================

-- Follows (Social connections)
CREATE TABLE IF NOT EXISTS follows (
    follower_id BIGINT REFERENCES athletes(id) ON DELETE CASCADE,
    following_id BIGINT REFERENCES athletes(id) ON DELETE CASCADE,
    follow_status VARCHAR(20) DEFAULT 'accepted',
    is_favorite BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    PRIMARY KEY (follower_id, following_id),
    CHECK (follower_id != following_id)
);

-- Comments
CREATE TABLE IF NOT EXISTS comments (
    id BIGSERIAL PRIMARY KEY,
    activity_id BIGINT REFERENCES activities(id) ON DELETE CASCADE,
    athlete_id BIGINT REFERENCES athletes(id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    comment_date TIMESTAMPTZ DEFAULT NOW()
);

-- Reactions (Kudos, etc.)
CREATE TABLE IF NOT EXISTS reactions (
    id BIGSERIAL PRIMARY KEY,
    parent_type VARCHAR(20) NOT NULL,
    parent_id BIGINT NOT NULL,
    athlete_id BIGINT REFERENCES athletes(id) ON DELETE CASCADE,
    reaction_type VARCHAR(20) NOT NULL,
    reaction_date TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(parent_type, parent_id, athlete_id, reaction_type)
);

-- =============================================================================
-- CLUB TABLES
-- =============================================================================

-- Clubs
CREATE TABLE IF NOT EXISTS clubs (
    id BIGSERIAL PRIMARY KEY,
    name VARCHAR(200) NOT NULL,
    description TEXT,
    club_type VARCHAR(50),
    sport VARCHAR(50),
    city VARCHAR(100),
    state VARCHAR(100),
    country VARCHAR(100),
    website VARCHAR(500),
    cover_photo VARCHAR(500),
    club_picture VARCHAR(500),
    member_count INTEGER DEFAULT 0 CHECK (member_count >= 0),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Club Memberships
CREATE TABLE IF NOT EXISTS memberships (
    athlete_id BIGINT REFERENCES athletes(id) ON DELETE CASCADE,
    club_id BIGINT REFERENCES clubs(id) ON DELETE CASCADE,
    join_date TIMESTAMPTZ DEFAULT NOW(),
    status VARCHAR(20) DEFAULT 'active',
    role VARCHAR(20) DEFAULT 'member',
    PRIMARY KEY (athlete_id, club_id)
);

-- =============================================================================
-- CHALLENGE AND GOAL TABLES
-- =============================================================================

-- Challenges
CREATE TABLE IF NOT EXISTS challenges (
    id BIGSERIAL PRIMARY KEY,
    name VARCHAR(200) NOT NULL,
    challenge_type VARCHAR(50),
    start_date DATE,
    end_date DATE,
    description TEXT,
    target_value DECIMAL(12,2) CHECK (target_value > 0),
    target_unit VARCHAR(20),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    CHECK (end_date >= start_date)
);

-- Challenge Participations
CREATE TABLE IF NOT EXISTS challenge_participations (
    athlete_id BIGINT REFERENCES athletes(id) ON DELETE CASCADE,
    challenge_id BIGINT REFERENCES challenges(id) ON DELETE CASCADE,
    join_date TIMESTAMPTZ DEFAULT NOW(),
    completed BOOLEAN DEFAULT FALSE,
    completion_date TIMESTAMPTZ,
    progress_value DECIMAL(12,2) DEFAULT 0 CHECK (progress_value >= 0),
    PRIMARY KEY (athlete_id, challenge_id)
);

-- Goals
CREATE TABLE IF NOT EXISTS goals (
    id BIGSERIAL PRIMARY KEY,
    athlete_id BIGINT REFERENCES athletes(id) ON DELETE CASCADE,
    goal_type VARCHAR(50),
    activity_type VARCHAR(50),
    target_value DECIMAL(12,2) CHECK (target_value > 0),
    start_date DATE,
    end_date DATE,
    segment_id BIGINT REFERENCES segments(id) ON DELETE SET NULL,
    time_period VARCHAR(20),
    interval_time INTEGER CHECK (interval_time > 0),
    current_value DECIMAL(12,2) DEFAULT 0 CHECK (current_value >= 0),
    completed BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    CHECK (end_date >= start_date)
);

-- =============================================================================
-- MEDIA AND SYSTEM TABLES
-- =============================================================================

-- Media (Photos, Videos)
CREATE TABLE IF NOT EXISTS media (
    id BIGSERIAL PRIMARY KEY,
    activity_id BIGINT REFERENCES activities(id) ON DELETE CASCADE,
    athlete_id BIGINT REFERENCES athletes(id) ON DELETE CASCADE,
    filename VARCHAR(500),
    caption TEXT,
    media_type VARCHAR(20),
    file_size BIGINT CHECK (file_size > 0),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Connected Applications
CREATE TABLE IF NOT EXISTS connected_apps (
    id BIGSERIAL PRIMARY KEY,
    athlete_id BIGINT REFERENCES athletes(id) ON DELETE CASCADE,
    app_name VARCHAR(200),
    enabled BOOLEAN DEFAULT TRUE,
    connected_at TIMESTAMPTZ DEFAULT NOW(),
    last_used TIMESTAMPTZ
);

-- Login History
CREATE TABLE IF NOT EXISTS logins (
    id BIGSERIAL PRIMARY KEY,
    athlete_id BIGINT REFERENCES athletes(id) ON DELETE CASCADE,
    ip_address INET,
    login_source VARCHAR(100),
    login_datetime TIMESTAMPTZ,
    user_agent TEXT,
    location VARCHAR(200)
);

-- =============================================================================
-- SUPABASE ROW LEVEL SECURITY (RLS) POLICIES
-- =============================================================================

-- Enable RLS on all tables
ALTER TABLE athletes ENABLE ROW LEVEL SECURITY;
ALTER TABLE activities ENABLE ROW LEVEL SECURITY;
ALTER TABLE gear ENABLE ROW LEVEL SECURITY;
ALTER TABLE routes ENABLE ROW LEVEL SECURITY;
ALTER TABLE segments ENABLE ROW LEVEL SECURITY;
ALTER TABLE follows ENABLE ROW LEVEL SECURITY;
ALTER TABLE comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE reactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE memberships ENABLE ROW LEVEL SECURITY;
ALTER TABLE challenge_participations ENABLE ROW LEVEL SECURITY;
ALTER TABLE goals ENABLE ROW LEVEL SECURITY;
ALTER TABLE media ENABLE ROW LEVEL SECURITY;
ALTER TABLE connected_apps ENABLE ROW LEVEL SECURITY;
ALTER TABLE logins ENABLE ROW LEVEL SECURITY;

-- Basic RLS policies (users can only access their own data)
CREATE POLICY "Users can view own athlete profile" ON athletes
    FOR SELECT USING (auth.uid() = auth_user_id);

CREATE POLICY "Users can update own athlete profile" ON athletes
    FOR UPDATE USING (auth.uid() = auth_user_id);

CREATE POLICY "Users can view own activities" ON activities
    FOR ALL USING (
        athlete_id IN (
            SELECT id FROM athletes WHERE auth_user_id = auth.uid()
        )
    );

CREATE POLICY "Users can view own gear" ON gear
    FOR ALL USING (
        athlete_id IN (
            SELECT id FROM athletes WHERE auth_user_id = auth.uid()
        )
    );

-- Reference tables are publicly readable
CREATE POLICY "Activity types are publicly readable" ON activity_types
    FOR SELECT USING (true);

CREATE POLICY "Brands are publicly readable" ON brands
    FOR SELECT USING (true);

CREATE POLICY "Models are publicly readable" ON models
    FOR SELECT USING (true);

-- =============================================================================
-- FUNCTIONS AND TRIGGERS
-- =============================================================================

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Add updated_at triggers to relevant tables
CREATE TRIGGER update_athletes_updated_at BEFORE UPDATE ON athletes
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_activities_updated_at BEFORE UPDATE ON activities
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_gear_updated_at BEFORE UPDATE ON gear
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_routes_updated_at BEFORE UPDATE ON routes
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_clubs_updated_at BEFORE UPDATE ON clubs
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();