-- Clean up only tables that exist in your current database
-- This version checks for table existence before deleting

-- Delete in reverse dependency order to avoid foreign key errors
-- Only delete from tables that exist

DO $$
BEGIN
    -- Challenge participations
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'challenge_participations') THEN
        DELETE FROM challenge_participations WHERE athlete_id = 1;
        RAISE NOTICE 'Cleaned challenge_participations';
    END IF;

    -- Goals
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'goals') THEN
        DELETE FROM goals WHERE athlete_id = 1;
        RAISE NOTICE 'Cleaned goals';
    END IF;

    -- Reactions
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'reactions') THEN
        DELETE FROM reactions WHERE athlete_id = 1;
        RAISE NOTICE 'Cleaned reactions';
    END IF;

    -- Comments
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'comments') THEN
        DELETE FROM comments WHERE athlete_id = 1;
        RAISE NOTICE 'Cleaned comments';
    END IF;

    -- Follows
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'follows') THEN
        DELETE FROM follows WHERE follower_id = 1 OR following_id = 1;
        RAISE NOTICE 'Cleaned follows';
    END IF;

    -- Media
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'media') THEN
        DELETE FROM media WHERE athlete_id = 1;
        RAISE NOTICE 'Cleaned media';
    END IF;

    -- Activities
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'activities') THEN
        DELETE FROM activities WHERE athlete_id = 1;
        RAISE NOTICE 'Cleaned activities';
    END IF;

    -- Gear
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'gear') THEN
        DELETE FROM gear WHERE athlete_id = 1;
        RAISE NOTICE 'Cleaned gear';
    END IF;

    -- Routes
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'routes') THEN
        DELETE FROM routes WHERE athlete_id = 1;
        RAISE NOTICE 'Cleaned routes';
    END IF;

    -- Connected apps
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'connected_apps') THEN
        DELETE FROM connected_apps WHERE athlete_id = 1;
        RAISE NOTICE 'Cleaned connected_apps';
    END IF;

    -- Logins
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'logins') THEN
        DELETE FROM logins WHERE athlete_id = 1;
        RAISE NOTICE 'Cleaned logins';
    END IF;

    -- Preferences tables (only if they exist)
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'general_preferences') THEN
        DELETE FROM general_preferences WHERE athlete_id = 1;
        RAISE NOTICE 'Cleaned general_preferences';
    END IF;

    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'email_preferences') THEN
        DELETE FROM email_preferences WHERE athlete_id = 1;
        RAISE NOTICE 'Cleaned email_preferences';
    END IF;

    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'social_settings') THEN
        DELETE FROM social_settings WHERE athlete_id = 1;
        RAISE NOTICE 'Cleaned social_settings';
    END IF;

    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'visibility_settings') THEN
        DELETE FROM visibility_settings WHERE athlete_id = 1;
        RAISE NOTICE 'Cleaned visibility_settings';
    END IF;

    -- Athletes (last to avoid foreign key errors)
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'athletes') THEN
        DELETE FROM athletes WHERE id = 1;
        RAISE NOTICE 'Cleaned athletes';
    END IF;

    -- Clean up external athletes
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'athletes') THEN
        DELETE FROM athletes WHERE first_name = 'External' AND last_name = 'Athlete';
        RAISE NOTICE 'Cleaned external athletes';
    END IF;
END $$;

-- Show what tables exist and their record counts
SELECT
    t.table_name,
    COALESCE(s.n_tup_ins, 0) as estimated_rows
FROM information_schema.tables t
LEFT JOIN pg_stat_user_tables s ON t.table_name = s.relname
WHERE t.table_schema = 'public'
AND t.table_type = 'BASE TABLE'
AND t.table_name NOT LIKE 'pg_%'
ORDER BY t.table_name;