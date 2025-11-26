-- Reference Data Insertion for Runaway Labs Database (Safe Version)
-- Populate lookup tables with common values - Supabase compatible

-- =============================================================================
-- ACTIVITY TYPES
-- =============================================================================

-- Insert activity types one by one to avoid conflicts
INSERT INTO activity_types (name, category)
SELECT 'Run', 'Running'
WHERE NOT EXISTS (SELECT 1 FROM activity_types WHERE name = 'Run');

INSERT INTO activity_types (name, category)
SELECT 'Ride', 'Cycling'
WHERE NOT EXISTS (SELECT 1 FROM activity_types WHERE name = 'Ride');

INSERT INTO activity_types (name, category)
SELECT 'Walk', 'Walking'
WHERE NOT EXISTS (SELECT 1 FROM activity_types WHERE name = 'Walk');

INSERT INTO activity_types (name, category)
SELECT 'Hike', 'Walking'
WHERE NOT EXISTS (SELECT 1 FROM activity_types WHERE name = 'Hike');

INSERT INTO activity_types (name, category)
SELECT 'VirtualRide', 'Cycling'
WHERE NOT EXISTS (SELECT 1 FROM activity_types WHERE name = 'VirtualRide');

INSERT INTO activity_types (name, category)
SELECT 'VirtualRun', 'Running'
WHERE NOT EXISTS (SELECT 1 FROM activity_types WHERE name = 'VirtualRun');

INSERT INTO activity_types (name, category)
SELECT 'Swim', 'Swimming'
WHERE NOT EXISTS (SELECT 1 FROM activity_types WHERE name = 'Swim');

INSERT INTO activity_types (name, category)
SELECT 'Workout', 'Training'
WHERE NOT EXISTS (SELECT 1 FROM activity_types WHERE name = 'Workout');

INSERT INTO activity_types (name, category)
SELECT 'WeightTraining', 'Training'
WHERE NOT EXISTS (SELECT 1 FROM activity_types WHERE name = 'WeightTraining');

INSERT INTO activity_types (name, category)
SELECT 'Yoga', 'Training'
WHERE NOT EXISTS (SELECT 1 FROM activity_types WHERE name = 'Yoga');

INSERT INTO activity_types (name, category)
SELECT 'Crossfit', 'Training'
WHERE NOT EXISTS (SELECT 1 FROM activity_types WHERE name = 'Crossfit');

INSERT INTO activity_types (name, category)
SELECT 'Elliptical', 'Training'
WHERE NOT EXISTS (SELECT 1 FROM activity_types WHERE name = 'Elliptical');

INSERT INTO activity_types (name, category)
SELECT 'Rowing', 'Training'
WHERE NOT EXISTS (SELECT 1 FROM activity_types WHERE name = 'Rowing');

INSERT INTO activity_types (name, category)
SELECT 'RockClimbing', 'Climbing'
WHERE NOT EXISTS (SELECT 1 FROM activity_types WHERE name = 'RockClimbing');

INSERT INTO activity_types (name, category)
SELECT 'AlpineSki', 'Winter Sports'
WHERE NOT EXISTS (SELECT 1 FROM activity_types WHERE name = 'AlpineSki');

INSERT INTO activity_types (name, category)
SELECT 'Snowboard', 'Winter Sports'
WHERE NOT EXISTS (SELECT 1 FROM activity_types WHERE name = 'Snowboard');

INSERT INTO activity_types (name, category)
SELECT 'MountainBikeRide', 'Cycling'
WHERE NOT EXISTS (SELECT 1 FROM activity_types WHERE name = 'MountainBikeRide');

INSERT INTO activity_types (name, category)
SELECT 'GravelRide', 'Cycling'
WHERE NOT EXISTS (SELECT 1 FROM activity_types WHERE name = 'GravelRide');

INSERT INTO activity_types (name, category)
SELECT 'TrailRun', 'Running'
WHERE NOT EXISTS (SELECT 1 FROM activity_types WHERE name = 'TrailRun');

-- =============================================================================
-- COMMON BRANDS
-- =============================================================================

-- Bike brands
INSERT INTO brands (name)
SELECT 'Specialized'
WHERE NOT EXISTS (SELECT 1 FROM brands WHERE name = 'Specialized');

INSERT INTO brands (name)
SELECT 'Trek'
WHERE NOT EXISTS (SELECT 1 FROM brands WHERE name = 'Trek');

INSERT INTO brands (name)
SELECT 'Giant'
WHERE NOT EXISTS (SELECT 1 FROM brands WHERE name = 'Giant');

INSERT INTO brands (name)
SELECT 'Cannondale'
WHERE NOT EXISTS (SELECT 1 FROM brands WHERE name = 'Cannondale');

INSERT INTO brands (name)
SELECT 'Canyon'
WHERE NOT EXISTS (SELECT 1 FROM brands WHERE name = 'Canyon');

INSERT INTO brands (name)
SELECT 'Scott'
WHERE NOT EXISTS (SELECT 1 FROM brands WHERE name = 'Scott');

-- Running shoe brands
INSERT INTO brands (name)
SELECT 'Nike'
WHERE NOT EXISTS (SELECT 1 FROM brands WHERE name = 'Nike');

INSERT INTO brands (name)
SELECT 'Adidas'
WHERE NOT EXISTS (SELECT 1 FROM brands WHERE name = 'Adidas');

INSERT INTO brands (name)
SELECT 'Brooks'
WHERE NOT EXISTS (SELECT 1 FROM brands WHERE name = 'Brooks');

INSERT INTO brands (name)
SELECT 'Asics'
WHERE NOT EXISTS (SELECT 1 FROM brands WHERE name = 'Asics');

INSERT INTO brands (name)
SELECT 'New Balance'
WHERE NOT EXISTS (SELECT 1 FROM brands WHERE name = 'New Balance');

INSERT INTO brands (name)
SELECT 'Saucony'
WHERE NOT EXISTS (SELECT 1 FROM brands WHERE name = 'Saucony');

INSERT INTO brands (name)
SELECT 'Hoka'
WHERE NOT EXISTS (SELECT 1 FROM brands WHERE name = 'Hoka');

INSERT INTO brands (name)
SELECT 'On Running'
WHERE NOT EXISTS (SELECT 1 FROM brands WHERE name = 'On Running');

-- =============================================================================
-- SAMPLE MODELS (using brand IDs)
-- =============================================================================

-- Specialized bike models
INSERT INTO models (brand_id, name, category)
SELECT b.id, 'Tarmac SL7', 'Road'
FROM brands b
WHERE b.name = 'Specialized'
AND NOT EXISTS (
    SELECT 1 FROM models m
    WHERE m.brand_id = b.id AND m.name = 'Tarmac SL7'
);

INSERT INTO models (brand_id, name, category)
SELECT b.id, 'Roubaix', 'Endurance'
FROM brands b
WHERE b.name = 'Specialized'
AND NOT EXISTS (
    SELECT 1 FROM models m
    WHERE m.brand_id = b.id AND m.name = 'Roubaix'
);

INSERT INTO models (brand_id, name, category)
SELECT b.id, 'Diverge', 'Gravel'
FROM brands b
WHERE b.name = 'Specialized'
AND NOT EXISTS (
    SELECT 1 FROM models m
    WHERE m.brand_id = b.id AND m.name = 'Diverge'
);

-- Nike shoe models
INSERT INTO models (brand_id, name, category)
SELECT b.id, 'Air Zoom Pegasus', 'Daily Trainer'
FROM brands b
WHERE b.name = 'Nike'
AND NOT EXISTS (
    SELECT 1 FROM models m
    WHERE m.brand_id = b.id AND m.name = 'Air Zoom Pegasus'
);

INSERT INTO models (brand_id, name, category)
SELECT b.id, 'Vaporfly', 'Racing'
FROM brands b
WHERE b.name = 'Nike'
AND NOT EXISTS (
    SELECT 1 FROM models m
    WHERE m.brand_id = b.id AND m.name = 'Vaporfly'
);

-- Brooks shoe models
INSERT INTO models (brand_id, name, category)
SELECT b.id, 'Ghost', 'Daily Trainer'
FROM brands b
WHERE b.name = 'Brooks'
AND NOT EXISTS (
    SELECT 1 FROM models m
    WHERE m.brand_id = b.id AND m.name = 'Ghost'
);

INSERT INTO models (brand_id, name, category)
SELECT b.id, 'Glycerin', 'Max Cushion'
FROM brands b
WHERE b.name = 'Brooks'
AND NOT EXISTS (
    SELECT 1 FROM models m
    WHERE m.brand_id = b.id AND m.name = 'Glycerin'
);

-- =============================================================================
-- USEFUL VIEWS FOR COMMON QUERIES
-- =============================================================================

-- Activity summary view
CREATE OR REPLACE VIEW activity_summary AS
SELECT
    a.id,
    a.name,
    at.name as activity_type,
    a.activity_date,
    a.distance,
    a.elapsed_time,
    a.elevation_gain,
    a.average_speed,
    a.average_heart_rate,
    a.average_watts,
    a.calories,
    g.name as gear_name
FROM activities a
LEFT JOIN activity_types at ON a.activity_type_id = at.id
LEFT JOIN gear g ON a.gear_id = g.id;

-- Monthly activity stats view
CREATE OR REPLACE VIEW monthly_activity_stats AS
SELECT
    a.athlete_id,
    EXTRACT(year FROM a.activity_date) as year,
    EXTRACT(month FROM a.activity_date) as month,
    at.name as activity_type,
    COUNT(*) as activity_count,
    SUM(a.distance) as total_distance,
    SUM(a.elapsed_time) as total_time,
    SUM(a.elevation_gain) as total_elevation,
    AVG(a.distance) as avg_distance
FROM activities a
LEFT JOIN activity_types at ON a.activity_type_id = at.id
WHERE a.activity_date IS NOT NULL
GROUP BY a.athlete_id, EXTRACT(year FROM a.activity_date), EXTRACT(month FROM a.activity_date), at.name
ORDER BY year DESC, month DESC, activity_type;