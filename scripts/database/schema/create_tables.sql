-- Strava Activities Table Creation Script
-- Based on CSV export structure with all fields

-- Create main activities table
CREATE TABLE IF NOT EXISTS activities (
    -- Primary identifiers
    activity_id BIGINT PRIMARY KEY,
    activity_date TIMESTAMP,
    activity_name TEXT,
    activity_type VARCHAR(50),
    activity_description TEXT,

    -- Summary fields (first occurrence in CSV)
    elapsed_time_summary INTEGER, -- Often empty in CSV
    distance_summary DECIMAL(10,2), -- Distance in miles
    max_heart_rate_summary INTEGER,
    relative_effort_summary INTEGER,
    commute_summary BOOLEAN,
    activity_private_note TEXT,
    activity_gear VARCHAR(100),
    filename TEXT,
    athlete_weight DECIMAL(5,1),
    bike_weight DECIMAL(5,1),

    -- Detailed metrics (second occurrence in CSV - primary data)
    elapsed_time INTEGER NOT NULL, -- Seconds
    moving_time INTEGER,
    distance DECIMAL(10,1), -- Distance in meters
    max_speed DECIMAL(6,3),
    average_speed DECIMAL(6,3),
    elevation_gain DECIMAL(8,1),
    elevation_loss DECIMAL(8,1),
    elevation_low DECIMAL(8,1),
    elevation_high DECIMAL(8,1),
    max_grade DECIMAL(5,1),
    average_grade DECIMAL(5,1),
    average_positive_grade DECIMAL(5,1),
    average_negative_grade DECIMAL(5,1),
    max_cadence INTEGER,
    average_cadence INTEGER,

    -- Heart rate metrics (detailed)
    max_heart_rate INTEGER,
    average_heart_rate INTEGER,

    -- Power metrics
    max_watts INTEGER,
    average_watts INTEGER,
    calories INTEGER,
    max_temperature INTEGER,
    average_temperature INTEGER,
    relative_effort INTEGER,
    total_work INTEGER,
    number_of_runs INTEGER,
    uphill_time INTEGER,
    downhill_time INTEGER,
    other_time INTEGER,
    perceived_exertion INTEGER,
    type VARCHAR(50), -- Duplicate of activity_type
    start_time TIMESTAMP,
    weighted_average_power INTEGER,
    power_count INTEGER,
    prefer_perceived_exertion BOOLEAN,
    perceived_relative_effort INTEGER,
    commute BOOLEAN, -- Duplicate of commute_summary
    total_weight_lifted DECIMAL(8,1),
    from_upload BOOLEAN,
    grade_adjusted_distance DECIMAL(10,1),

    -- Weather data
    weather_observation_time TIMESTAMP,
    weather_condition VARCHAR(100),
    weather_temperature INTEGER,
    apparent_temperature INTEGER,
    dewpoint INTEGER,
    humidity INTEGER,
    weather_pressure DECIMAL(8,1),
    wind_speed DECIMAL(5,1),
    wind_gust DECIMAL(5,1),
    wind_bearing INTEGER,
    precipitation_intensity DECIMAL(5,3),
    sunrise_time TIMESTAMP,
    sunset_time TIMESTAMP,
    moon_phase DECIMAL(3,2),

    -- Gear
    bike VARCHAR(100),
    gear VARCHAR(100),

    -- Additional weather
    precipitation_probability DECIMAL(3,2),
    precipitation_type VARCHAR(50),
    cloud_cover DECIMAL(3,2),
    weather_visibility DECIMAL(5,1),
    uv_index INTEGER,
    weather_ozone INTEGER,

    -- Activity metrics
    jump_count INTEGER,
    total_grit DECIMAL(5,1),
    average_flow DECIMAL(5,1),
    flagged BOOLEAN,
    average_elapsed_speed DECIMAL(6,3),
    dirt_distance DECIMAL(10,1),
    newly_explored_distance DECIMAL(10,1),
    newly_explored_dirt_distance DECIMAL(10,1),
    activity_count INTEGER,
    total_steps INTEGER,
    carbon_saved DECIMAL(8,2),
    pool_length INTEGER,
    training_load INTEGER,
    intensity DECIMAL(5,2),
    average_grade_adjusted_pace DECIMAL(8,3),
    timer_time INTEGER,
    total_cycles INTEGER,
    recovery INTEGER,
    with_pet BOOLEAN,
    competition BOOLEAN,
    long_run BOOLEAN,
    for_a_cause BOOLEAN,
    media TEXT,

    -- Timestamps
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create athletes table (referenced by activities)
CREATE TABLE IF NOT EXISTS athletes (
    id SERIAL PRIMARY KEY,
    resource_state INTEGER,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create gear table
CREATE TABLE IF NOT EXISTS gear (
    id VARCHAR(100) PRIMARY KEY,
    name VARCHAR(200),
    primary_gear BOOLEAN DEFAULT FALSE,
    resource_state INTEGER,
    distance_traveled BIGINT DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_activities_date ON activities(activity_date);
CREATE INDEX IF NOT EXISTS idx_activities_type ON activities(activity_type);
CREATE INDEX IF NOT EXISTS idx_activities_distance ON activities(distance);
CREATE INDEX IF NOT EXISTS idx_activities_elapsed_time ON activities(elapsed_time);
CREATE INDEX IF NOT EXISTS idx_activities_gear ON activities(gear);
CREATE INDEX IF NOT EXISTS idx_activities_flagged ON activities(flagged);

-- Add foreign key relationship (optional, can be added later)
-- ALTER TABLE activities ADD CONSTRAINT fk_activities_gear
--     FOREIGN KEY (gear) REFERENCES gear(id);

-- Insert default athlete record
INSERT INTO athletes (id, resource_state)
VALUES (1, 1)
ON CONFLICT (id) DO NOTHING;