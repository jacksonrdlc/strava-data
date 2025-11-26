-- Reference Data Insertion for Runaway Labs Database
-- Populate lookup tables with common values

-- =============================================================================
-- ACTIVITY TYPES
-- =============================================================================

INSERT INTO activity_types (name, category) VALUES
    ('Run', 'Running'),
    ('Ride', 'Cycling'),
    ('Walk', 'Walking'),
    ('Hike', 'Walking'),
    ('VirtualRide', 'Cycling'),
    ('VirtualRun', 'Running'),
    ('Swim', 'Swimming'),
    ('Workout', 'Training'),
    ('WeightTraining', 'Training'),
    ('Yoga', 'Training'),
    ('Crossfit', 'Training'),
    ('Elliptical', 'Training'),
    ('StairStepper', 'Training'),
    ('Rowing', 'Training'),
    ('RockClimbing', 'Climbing'),
    ('AlpineSki', 'Winter Sports'),
    ('BackcountrySki', 'Winter Sports'),
    ('NordicSki', 'Winter Sports'),
    ('Snowboard', 'Winter Sports'),
    ('Snowshoe', 'Winter Sports'),
    ('IceSkate', 'Winter Sports'),
    ('InlineSkate', 'Skating'),
    ('Kitesurf', 'Water Sports'),
    ('Windsurf', 'Water Sports'),
    ('Kayaking', 'Water Sports'),
    ('Canoeing', 'Water Sports'),
    ('StandUpPaddling', 'Water Sports'),
    ('Surfing', 'Water Sports'),
    ('Sail', 'Water Sports'),
    ('Golf', 'Other'),
    ('Soccer', 'Team Sports'),
    ('Tennis', 'Racquet Sports'),
    ('Badminton', 'Racquet Sports'),
    ('Squash', 'Racquet Sports'),
    ('TableTennis', 'Racquet Sports'),
    ('Handball', 'Team Sports'),
    ('Hockey', 'Team Sports'),
    ('Floorball', 'Team Sports'),
    ('Volleyball', 'Team Sports'),
    ('Basketball', 'Team Sports'),
    ('Football', 'Team Sports'),
    ('Rugby', 'Team Sports'),
    ('Baseball', 'Team Sports'),
    ('Softball', 'Team Sports'),
    ('Cricket', 'Team Sports'),
    ('EMountainBikeRide', 'Cycling'),
    ('MountainBikeRide', 'Cycling'),
    ('GravelRide', 'Cycling'),
    ('Handcycle', 'Cycling'),
    ('TrailRun', 'Running'),
    ('Pickleball', 'Racquet Sports')
ON CONFLICT (name) DO NOTHING;

-- =============================================================================
-- COMMON BRANDS
-- =============================================================================

-- Bike brands
INSERT INTO brands (name) VALUES
    ('Specialized'),
    ('Trek'),
    ('Giant'),
    ('Cannondale'),
    ('Cervélo'),
    ('Pinarello'),
    ('BMC'),
    ('Colnago'),
    ('Canyon'),
    ('Bianchi'),
    ('Scott'),
    ('Merida'),
    ('Orbea'),
    ('Cube'),
    ('Santa Cruz'),
    ('Yeti'),
    ('Niner'),
    ('Salsa'),
    ('Surly'),
    ('All-City')
ON CONFLICT (name) DO NOTHING;

-- Running shoe brands
INSERT INTO brands (name) VALUES
    ('Nike'),
    ('Adidas'),
    ('Brooks'),
    ('Asics'),
    ('New Balance'),
    ('Saucony'),
    ('Hoka'),
    ('Mizuno'),
    ('Under Armour'),
    ('Salomon'),
    ('Altra'),
    ('Topo Athletic'),
    ('Inov-8'),
    ('La Sportiva'),
    ('Merrell'),
    ('Vibram'),
    ('Allbirds'),
    ('On Running'),
    ('Vans'),
    ('Converse')
ON CONFLICT (name) DO NOTHING;

-- =============================================================================
-- SAMPLE MODELS (for demonstration)
-- =============================================================================

-- Get brand IDs for model insertion
DO $$
DECLARE
    specialized_id INT;
    nike_id INT;
    brooks_id INT;
    trek_id INT;
BEGIN
    SELECT id INTO specialized_id FROM brands WHERE name = 'Specialized';
    SELECT id INTO nike_id FROM brands WHERE name = 'Nike';
    SELECT id INTO brooks_id FROM brands WHERE name = 'Brooks';
    SELECT id INTO trek_id FROM brands WHERE name = 'Trek';

    -- Bike models
    IF specialized_id IS NOT NULL THEN
        INSERT INTO models (brand_id, name, category) VALUES
            (specialized_id, 'Tarmac SL7', 'Road'),
            (specialized_id, 'Roubaix', 'Endurance'),
            (specialized_id, 'Allez', 'Road'),
            (specialized_id, 'Diverge', 'Gravel'),
            (specialized_id, 'Epic', 'Mountain'),
            (specialized_id, 'Stumpjumper', 'Mountain')
        ON CONFLICT (brand_id, name) DO NOTHING;
    END IF;

    IF trek_id IS NOT NULL THEN
        INSERT INTO models (brand_id, name, category) VALUES
            (trek_id, 'Madone', 'Road'),
            (trek_id, 'Domane', 'Endurance'),
            (trek_id, 'Émonda', 'Road'),
            (trek_id, 'Checkpoint', 'Gravel'),
            (trek_id, 'Fuel EX', 'Mountain'),
            (trek_id, 'Top Fuel', 'Mountain')
        ON CONFLICT (brand_id, name) DO NOTHING;
    END IF;

    -- Running shoe models
    IF nike_id IS NOT NULL THEN
        INSERT INTO models (brand_id, name, category) VALUES
            (nike_id, 'Air Zoom Pegasus', 'Daily Trainer'),
            (nike_id, 'Vaporfly', 'Racing'),
            (nike_id, 'Air Zoom Tempo', 'Tempo'),
            (nike_id, 'React Infinity Run', 'Daily Trainer'),
            (nike_id, 'ZoomX Invincible', 'Max Cushion'),
            (nike_id, 'Wildhorse', 'Trail')
        ON CONFLICT (brand_id, name) DO NOTHING;
    END IF;

    IF brooks_id IS NOT NULL THEN
        INSERT INTO models (brand_id, name, category) VALUES
            (brooks_id, 'Ghost', 'Daily Trainer'),
            (brooks_id, 'Glycerin', 'Max Cushion'),
            (brooks_id, 'Adrenaline GTS', 'Stability'),
            (brooks_id, 'Launch', 'Tempo'),
            (brooks_id, 'Hyperion', 'Racing'),
            (brooks_id, 'Cascadia', 'Trail')
        ON CONFLICT (brand_id, name) DO NOTHING;
    END IF;
END $$;

-- =============================================================================
-- SAMPLE CHALLENGES (Global challenges that commonly appear)
-- =============================================================================

INSERT INTO challenges (name, challenge_type, start_date, end_date, description, target_value, target_unit) VALUES
    ('Run 5K Challenge', 'distance', '2023-01-01', '2023-12-31', 'Complete a 5K run', 5000, 'meters'),
    ('Climb Everest Challenge', 'elevation', '2023-01-01', '2023-12-31', 'Climb the equivalent elevation of Mount Everest', 8848, 'meters'),
    ('Century Ride Challenge', 'distance', '2023-01-01', '2023-12-31', 'Complete a 100-mile bike ride', 160934, 'meters'),
    ('Marathon Challenge', 'distance', '2023-01-01', '2023-12-31', 'Complete a marathon distance', 42195, 'meters'),
    ('Swim 2.4 Miles Challenge', 'distance', '2023-01-01', '2023-12-31', 'Swim 2.4 miles', 3862, 'meters'),
    ('Half Marathon Challenge', 'distance', '2023-01-01', '2023-12-31', 'Complete a half marathon', 21098, 'meters'),
    ('10K Challenge', 'distance', '2023-01-01', '2023-12-31', 'Complete a 10K run', 10000, 'meters'),
    ('Metric Century Challenge', 'distance', '2023-01-01', '2023-12-31', 'Complete a 100K bike ride', 100000, 'meters'),
    ('Gran Fondo Challenge', 'distance', '2023-01-01', '2023-12-31', 'Complete a gran fondo distance', 120000, 'meters'),
    ('Triathlon Challenge', 'multisport', '2023-01-01', '2023-12-31', 'Complete swim, bike, and run activities', 1, 'activities')
ON CONFLICT (name) DO NOTHING;

-- =============================================================================
-- SAMPLE PRIVACY ZONES (common locations to obscure)
-- =============================================================================

-- Note: These are sample data - real privacy zones would be user-specific
-- INSERT INTO privacy_zones (athlete_id, name, latitude, longitude, radius_meters) VALUES
--     (1, 'Home', 37.7749, -122.4194, 200),
--     (1, 'Work', 37.7849, -122.4094, 100),
--     (1, 'School', 37.7649, -122.4294, 150);

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
    g.name as gear_name,
    CASE
        WHEN a.distance IS NOT NULL AND a.elapsed_time IS NOT NULL AND a.elapsed_time > 0
        THEN a.distance / a.elapsed_time
        ELSE NULL
    END as pace_mps
FROM activities a
LEFT JOIN activity_types at ON a.activity_type_id = at.id
LEFT JOIN gear g ON a.gear_id = g.id;

-- Athlete activity stats view
CREATE OR REPLACE VIEW athlete_stats AS
SELECT
    a.athlete_id,
    COUNT(*) as total_activities,
    SUM(a.distance) as total_distance,
    SUM(a.elapsed_time) as total_time,
    SUM(a.elevation_gain) as total_elevation,
    AVG(a.distance) as avg_distance,
    AVG(a.elapsed_time) as avg_time,
    MAX(a.distance) as max_distance,
    MAX(a.elapsed_time) as max_time,
    MIN(a.activity_date) as first_activity,
    MAX(a.activity_date) as last_activity
FROM activities a
WHERE a.distance IS NOT NULL
GROUP BY a.athlete_id;

-- Monthly activity summary
CREATE OR REPLACE VIEW monthly_summary AS
SELECT
    a.athlete_id,
    DATE_TRUNC('month', a.activity_date) as month,
    at.name as activity_type,
    COUNT(*) as activity_count,
    SUM(a.distance) as total_distance,
    SUM(a.elapsed_time) as total_time,
    SUM(a.elevation_gain) as total_elevation,
    AVG(a.distance) as avg_distance
FROM activities a
LEFT JOIN activity_types at ON a.activity_type_id = at.id
WHERE a.activity_date IS NOT NULL
GROUP BY a.athlete_id, DATE_TRUNC('month', a.activity_date), at.name
ORDER BY month DESC, activity_type;

-- Gear usage summary
CREATE OR REPLACE VIEW gear_usage AS
SELECT
    g.id,
    g.name,
    g.gear_type,
    b.name as brand_name,
    m.name as model_name,
    COUNT(a.id) as activity_count,
    SUM(a.distance) as total_distance,
    SUM(a.elapsed_time) as total_time,
    AVG(a.distance) as avg_distance_per_activity
FROM gear g
LEFT JOIN brands b ON g.brand_id = b.id
LEFT JOIN models m ON g.model_id = m.id
LEFT JOIN activities a ON g.id = a.gear_id
GROUP BY g.id, g.name, g.gear_type, b.name, m.name
ORDER BY total_distance DESC;