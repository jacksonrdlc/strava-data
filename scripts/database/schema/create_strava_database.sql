-- Runaway Labs - Strava Data Export Database Schema
-- Created based on comprehensive analysis of Strava data export files

-- Create database (PostgreSQL syntax)
CREATE DATABASE runaway_labs;
-- \c runaway_labs;

-- Enable UUID extension if using PostgreSQL
-- CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =============================================================================
-- REFERENCE/LOOKUP TABLES
-- =============================================================================

-- Activity Types
CREATE TABLE activity_types (
    id SERIAL PRIMARY KEY,
    name VARCHAR(50) NOT NULL UNIQUE,
    category VARCHAR(30),
    description TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Brands (for gear)
CREATE TABLE brands (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL UNIQUE,
    description TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Models (for gear)
CREATE TABLE models (
    id SERIAL PRIMARY KEY,
    brand_id INTEGER REFERENCES brands(id),
    name VARCHAR(100) NOT NULL,
    category VARCHAR(50),
    description TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(brand_id, name)
);

-- =============================================================================
-- CORE USER TABLES
-- =============================================================================

-- Athletes (Users)
CREATE TABLE athletes (
    id BIGINT PRIMARY KEY,
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
    health_consent_date TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- =============================================================================
-- GEAR TABLES
-- =============================================================================

-- Gear (Bikes, Shoes, etc.)
CREATE TABLE gear (
    id VARCHAR(100) PRIMARY KEY, -- Strava uses string IDs for gear
    athlete_id BIGINT NOT NULL REFERENCES athletes(id),
    brand_id INTEGER REFERENCES brands(id),
    model_id INTEGER REFERENCES models(id),
    gear_type VARCHAR(20) NOT NULL CHECK (gear_type IN ('bike', 'shoe', 'other')),
    name VARCHAR(200),
    is_primary BOOLEAN DEFAULT FALSE,
    total_distance BIGINT DEFAULT 0, -- meters
    retired BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- =============================================================================
-- ACTIVITY TABLES
-- =============================================================================

-- Activities (Main data table)
CREATE TABLE activities (
    id BIGINT PRIMARY KEY,
    athlete_id BIGINT NOT NULL REFERENCES athletes(id),
    activity_type_id INTEGER REFERENCES activity_types(id),
    name VARCHAR(500),
    description TEXT,

    -- Temporal data
    activity_date TIMESTAMP NOT NULL,
    start_time TIMESTAMP,

    -- Performance metrics
    elapsed_time INTEGER, -- seconds
    moving_time INTEGER, -- seconds
    timer_time INTEGER, -- seconds
    distance DECIMAL(12,2), -- meters

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
    max_heart_rate INTEGER,
    average_heart_rate INTEGER,
    has_heartrate BOOLEAN DEFAULT FALSE,

    -- Power data
    max_watts INTEGER,
    average_watts INTEGER,
    weighted_average_watts INTEGER,
    device_watts BOOLEAN DEFAULT FALSE,
    total_work INTEGER, -- kilojoules

    -- Cadence data
    max_cadence INTEGER,
    average_cadence INTEGER,

    -- Environmental data
    calories INTEGER,
    max_temperature INTEGER,
    average_temperature INTEGER,
    weather_condition VARCHAR(100),
    humidity INTEGER,
    wind_speed DECIMAL(5,1),
    wind_gust DECIMAL(5,1),
    wind_bearing INTEGER,
    precipitation_intensity DECIMAL(5,3),
    precipitation_probability DECIMAL(3,2),
    precipitation_type VARCHAR(50),
    cloud_cover DECIMAL(3,2),
    weather_visibility DECIMAL(5,1),
    uv_index INTEGER,
    weather_ozone INTEGER,
    weather_pressure DECIMAL(8,1),
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
    filename VARCHAR(500), -- Link to .fit.gz files

    -- Gear reference
    gear_id VARCHAR(100) REFERENCES gear(id),

    -- Additional metrics
    perceived_exertion INTEGER,
    relative_effort INTEGER,
    training_load INTEGER,
    intensity DECIMAL(5,2),
    average_grade_adjusted_pace DECIMAL(8,3),
    grade_adjusted_distance DECIMAL(10,1),
    dirt_distance DECIMAL(10,1),
    newly_explored_distance DECIMAL(10,1),
    newly_explored_dirt_distance DECIMAL(10,1),
    total_steps INTEGER,
    carbon_saved DECIMAL(8,2),
    pool_length INTEGER,
    total_cycles INTEGER,
    jump_count INTEGER,
    total_grit DECIMAL(5,1),
    average_flow DECIMAL(5,1),

    -- Metadata
    from_upload BOOLEAN DEFAULT FALSE,
    resource_state INTEGER DEFAULT 2,
    external_id VARCHAR(200),

    -- Timestamps
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- =============================================================================
-- GEOGRAPHIC TABLES
-- =============================================================================

-- Routes
CREATE TABLE routes (
    id BIGINT PRIMARY KEY,
    athlete_id BIGINT NOT NULL REFERENCES athletes(id),
    name VARCHAR(500),
    filename VARCHAR(500), -- Link to GPX files
    description TEXT,
    distance DECIMAL(12,2),
    elevation_gain DECIMAL(8,1),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Segments
CREATE TABLE segments (
    id BIGINT PRIMARY KEY,
    activity_id BIGINT REFERENCES activities(id),
    name VARCHAR(500),
    start_latitude DECIMAL(10, 7),
    start_longitude DECIMAL(10, 7),
    end_latitude DECIMAL(10, 7),
    end_longitude DECIMAL(10, 7),
    distance DECIMAL(10,2),
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
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Local Legend Segments (special segments)
CREATE TABLE local_legend_segments (
    segment_id BIGINT PRIMARY KEY,
    segment_name VARCHAR(500),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Starred Routes
CREATE TABLE starred_routes (
    athlete_id BIGINT REFERENCES athletes(id),
    route_id BIGINT,
    starred_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (athlete_id, route_id)
);

-- Starred Segments
CREATE TABLE starred_segments (
    athlete_id BIGINT REFERENCES athletes(id),
    segment_id BIGINT REFERENCES segments(id),
    starred_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (athlete_id, segment_id)
);

-- =============================================================================
-- SOCIAL TABLES
-- =============================================================================

-- Follows (Social connections)
CREATE TABLE follows (
    follower_id BIGINT REFERENCES athletes(id),
    following_id BIGINT REFERENCES athletes(id),
    follow_status VARCHAR(20) DEFAULT 'accepted',
    is_favorite BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (follower_id, following_id)
);

-- Comments
CREATE TABLE comments (
    id BIGSERIAL PRIMARY KEY,
    activity_id BIGINT REFERENCES activities(id),
    athlete_id BIGINT REFERENCES athletes(id),
    content TEXT NOT NULL,
    comment_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Reactions (Kudos, etc.)
CREATE TABLE reactions (
    id BIGSERIAL PRIMARY KEY,
    parent_type VARCHAR(20) NOT NULL, -- 'Activity', 'Comment', etc.
    parent_id BIGINT NOT NULL,
    athlete_id BIGINT REFERENCES athletes(id),
    reaction_type VARCHAR(20) NOT NULL,
    reaction_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(parent_type, parent_id, athlete_id, reaction_type)
);

-- Blocks
CREATE TABLE blocks (
    blocker_id BIGINT REFERENCES athletes(id),
    blocked_id BIGINT REFERENCES athletes(id),
    blocked_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (blocker_id, blocked_id)
);

-- Posts (Social media style posts)
CREATE TABLE posts (
    id BIGSERIAL PRIMARY KEY,
    athlete_id BIGINT REFERENCES athletes(id),
    content TEXT,
    post_type VARCHAR(50),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- =============================================================================
-- CLUB TABLES
-- =============================================================================

-- Clubs
CREATE TABLE clubs (
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
    member_count INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Club Memberships
CREATE TABLE memberships (
    athlete_id BIGINT REFERENCES athletes(id),
    club_id BIGINT REFERENCES clubs(id),
    join_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    status VARCHAR(20) DEFAULT 'active',
    role VARCHAR(20) DEFAULT 'member',
    PRIMARY KEY (athlete_id, club_id)
);

-- =============================================================================
-- CHALLENGE AND GOAL TABLES
-- =============================================================================

-- Challenges
CREATE TABLE challenges (
    id BIGSERIAL PRIMARY KEY,
    name VARCHAR(200) NOT NULL,
    challenge_type VARCHAR(50),
    start_date DATE,
    end_date DATE,
    description TEXT,
    target_value DECIMAL(12,2),
    target_unit VARCHAR(20),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Challenge Participations
CREATE TABLE challenge_participations (
    athlete_id BIGINT REFERENCES athletes(id),
    challenge_id BIGINT REFERENCES challenges(id),
    join_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    completed BOOLEAN DEFAULT FALSE,
    completion_date TIMESTAMP,
    progress_value DECIMAL(12,2),
    PRIMARY KEY (athlete_id, challenge_id)
);

-- Goals
CREATE TABLE goals (
    id BIGSERIAL PRIMARY KEY,
    athlete_id BIGINT REFERENCES athletes(id),
    goal_type VARCHAR(50),
    activity_type VARCHAR(50),
    target_value DECIMAL(12,2),
    start_date DATE,
    end_date DATE,
    segment_id BIGINT REFERENCES segments(id),
    time_period VARCHAR(20),
    interval_time INTEGER,
    current_value DECIMAL(12,2) DEFAULT 0,
    completed BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Monthly Recap Achievements
CREATE TABLE monthly_recap_achievements (
    id BIGSERIAL PRIMARY KEY,
    athlete_id BIGINT REFERENCES athletes(id),
    achievement_type VARCHAR(100),
    achievement_date DATE,
    value DECIMAL(12,2),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- =============================================================================
-- MEDIA TABLES
-- =============================================================================

-- Media (Photos, Videos)
CREATE TABLE media (
    id BIGSERIAL PRIMARY KEY,
    activity_id BIGINT REFERENCES activities(id),
    athlete_id BIGINT REFERENCES athletes(id),
    filename VARCHAR(500),
    caption TEXT,
    media_type VARCHAR(20),
    file_size BIGINT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- =============================================================================
-- SYSTEM/TECHNICAL TABLES
-- =============================================================================

-- Connected Applications
CREATE TABLE connected_apps (
    id BIGSERIAL PRIMARY KEY,
    athlete_id BIGINT REFERENCES athletes(id),
    app_name VARCHAR(200),
    enabled BOOLEAN DEFAULT TRUE,
    connected_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_used TIMESTAMP
);

-- Login History
CREATE TABLE logins (
    id BIGSERIAL PRIMARY KEY,
    athlete_id BIGINT REFERENCES athletes(id),
    ip_address INET,
    login_source VARCHAR(100),
    login_datetime TIMESTAMP,
    user_agent TEXT,
    location VARCHAR(200)
);

-- Contacts
CREATE TABLE contacts (
    id BIGSERIAL PRIMARY KEY,
    athlete_id BIGINT REFERENCES athletes(id),
    contact_athlete_id BIGINT REFERENCES athletes(id),
    contact_type VARCHAR(50),
    contact_value VARCHAR(200),
    contact_source VARCHAR(100),
    contact_name VARCHAR(200),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Privacy Zones
CREATE TABLE privacy_zones (
    id BIGSERIAL PRIMARY KEY,
    athlete_id BIGINT REFERENCES athletes(id),
    name VARCHAR(200),
    latitude DECIMAL(10, 7),
    longitude DECIMAL(10, 7),
    radius_meters INTEGER,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Preferences and Settings
CREATE TABLE general_preferences (
    athlete_id BIGINT PRIMARY KEY REFERENCES athletes(id),
    preference_type VARCHAR(100),
    preference_value TEXT,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE email_preferences (
    athlete_id BIGINT PRIMARY KEY REFERENCES athletes(id),
    email_type VARCHAR(100),
    enabled BOOLEAN DEFAULT TRUE,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE social_settings (
    athlete_id BIGINT PRIMARY KEY REFERENCES athletes(id),
    setting_type VARCHAR(100),
    setting_value TEXT,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE visibility_settings (
    athlete_id BIGINT PRIMARY KEY REFERENCES athletes(id),
    setting_type VARCHAR(100),
    visibility_level VARCHAR(50),
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Support Tickets
CREATE TABLE support_tickets (
    id BIGSERIAL PRIMARY KEY,
    athlete_id BIGINT REFERENCES athletes(id),
    ticket_subject VARCHAR(500),
    ticket_description TEXT,
    status VARCHAR(50),
    priority VARCHAR(20),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    resolved_at TIMESTAMP
);

-- Orders (Subscription/Purchase history)
CREATE TABLE orders (
    id BIGSERIAL PRIMARY KEY,
    athlete_id BIGINT REFERENCES athletes(id),
    order_type VARCHAR(100),
    amount DECIMAL(10,2),
    currency CHAR(3),
    status VARCHAR(50),
    order_date TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Device Identifiers
CREATE TABLE mobile_device_identifiers (
    id BIGSERIAL PRIMARY KEY,
    athlete_id BIGINT REFERENCES athletes(id),
    device_identifier VARCHAR(200),
    device_type VARCHAR(50),
    platform VARCHAR(50),
    registered_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Flags/Reports
CREATE TABLE flags (
    id BIGSERIAL PRIMARY KEY,
    reporter_id BIGINT REFERENCES athletes(id),
    target_type VARCHAR(20), -- 'activity', 'athlete', 'comment'
    target_id BIGINT,
    flag_reason VARCHAR(100),
    description TEXT,
    status VARCHAR(20) DEFAULT 'pending',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Events
CREATE TABLE events (
    id BIGSERIAL PRIMARY KEY,
    name VARCHAR(200),
    description TEXT,
    event_type VARCHAR(50),
    start_date DATE,
    end_date DATE,
    location VARCHAR(200),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Event Participations
CREATE TABLE event_participations (
    athlete_id BIGINT REFERENCES athletes(id),
    event_id BIGINT REFERENCES events(id),
    participation_status VARCHAR(20),
    registered_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (athlete_id, event_id)
);