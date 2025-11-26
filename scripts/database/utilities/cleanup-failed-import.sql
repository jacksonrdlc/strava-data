-- Clean up any partially imported data before running the fixed import script
-- Run this if you want to start completely fresh

-- Delete in reverse dependency order to avoid foreign key errors
DELETE FROM challenge_participations WHERE athlete_id = 1;
DELETE FROM goals WHERE athlete_id = 1;
DELETE FROM reactions WHERE athlete_id = 1;
DELETE FROM comments WHERE athlete_id = 1;
DELETE FROM follows WHERE follower_id = 1 OR following_id = 1;
DELETE FROM media WHERE athlete_id = 1;
DELETE FROM activities WHERE athlete_id = 1;
DELETE FROM gear WHERE athlete_id = 1;
DELETE FROM routes WHERE athlete_id = 1;
DELETE FROM connected_apps WHERE athlete_id = 1;
DELETE FROM logins WHERE athlete_id = 1;
DELETE FROM general_preferences WHERE athlete_id = 1;
DELETE FROM email_preferences WHERE athlete_id = 1;
DELETE FROM social_settings WHERE athlete_id = 1;
DELETE FROM visibility_settings WHERE athlete_id = 1;
DELETE FROM athletes WHERE id = 1;

-- Also clean up any external athletes that were created
DELETE FROM athletes WHERE first_name = 'External' AND last_name = 'Athlete';

-- Reset any auto-incrementing sequences if needed
-- (Not applicable here since we're using specific IDs)

-- Show what's left
SELECT 'athletes' as table_name, count(*) as remaining_records FROM athletes
UNION ALL
SELECT 'activities', count(*) FROM activities
UNION ALL
SELECT 'reactions', count(*) FROM reactions
UNION ALL
SELECT 'follows', count(*) FROM follows
ORDER BY table_name;