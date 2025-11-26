-- Fix elapsed_time constraint to allow zero values for test/incomplete activities
-- This allows golf and other activities with zero elapsed time to be imported

-- Drop the existing constraint
ALTER TABLE activities DROP CONSTRAINT IF EXISTS activities_elapsed_time_check;

-- Add the new constraint that allows >= 0 instead of > 0
ALTER TABLE activities ADD CONSTRAINT activities_elapsed_time_check
    CHECK (elapsed_time >= 0);

-- Verify the constraint was updated
SELECT conname, pg_get_constraintdef(oid)
FROM pg_constraint
WHERE conrelid = 'activities'::regclass
    AND conname = 'activities_elapsed_time_check';