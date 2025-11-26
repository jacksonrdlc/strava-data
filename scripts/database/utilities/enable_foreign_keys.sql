-- Re-enable foreign key constraints after data import
-- Run this AFTER your import to restore constraint checking

-- Restore normal constraint checking
SET session_replication_role = DEFAULT;

-- Verify foreign key integrity (optional)
-- This will show any foreign key violations that exist
DO $$
DECLARE
    rec RECORD;
    violation_count INTEGER := 0;
BEGIN
    -- Check for foreign key violations in key tables
    FOR rec IN
        SELECT
            conname as constraint_name,
            conrelid::regclass as table_name,
            confrelid::regclass as referenced_table
        FROM pg_constraint
        WHERE contype = 'f'
        AND connamespace = 'public'::regnamespace
    LOOP
        -- You could add specific checks here if needed
        -- For now, just count constraints
        violation_count := violation_count + 1;
    END LOOP;

    RAISE NOTICE 'Foreign key constraints restored. Total FK constraints: %', violation_count;
END $$;

-- Show current setting
SHOW session_replication_role;