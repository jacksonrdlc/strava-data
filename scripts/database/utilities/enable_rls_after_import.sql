-- Re-enable RLS after data import
-- Run this AFTER importing data to restore security

-- Re-enable RLS on all tables
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
ALTER TABLE general_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE email_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE social_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE visibility_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE challenges ENABLE ROW LEVEL SECURITY;
ALTER TABLE clubs ENABLE ROW LEVEL SECURITY;

-- Update RLS policies to work with imported data
-- Allow users to access data linked to their athlete ID

-- Athletes table - users can access their own profile
DROP POLICY IF EXISTS "Users can view own athlete profile" ON athletes;
DROP POLICY IF EXISTS "Users can update own athlete profile" ON athletes;

CREATE POLICY "Users can view own athlete profile" ON athletes
    FOR SELECT USING (
        auth.uid() = auth_user_id OR
        id IN (SELECT athlete_id FROM activities WHERE athlete_id = 1) -- Allow access to imported data
    );

CREATE POLICY "Users can update own athlete profile" ON athletes
    FOR UPDATE USING (auth.uid() = auth_user_id);

-- Activities - allow users to access activities linked to their athlete profile
DROP POLICY IF EXISTS "Users can view own activities" ON activities;

CREATE POLICY "Users can view own activities" ON activities
    FOR ALL USING (
        athlete_id IN (
            SELECT id FROM athletes
            WHERE auth_user_id = auth.uid() OR id = 1 -- Allow access to imported data
        )
    );

-- Similar updates for other tables to allow access to imported data
DROP POLICY IF EXISTS "Users can view own gear" ON gear;

CREATE POLICY "Users can view own gear" ON gear
    FOR ALL USING (
        athlete_id IN (
            SELECT id FROM athletes
            WHERE auth_user_id = auth.uid() OR id = 1 -- Allow access to imported data
        )
    );

-- Show final status
SELECT schemaname, tablename, rowsecurity
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY tablename;