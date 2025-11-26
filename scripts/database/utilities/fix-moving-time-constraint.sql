-- Fix moving_time constraint to allow zero values for stationary activities
-- This allows golf and other stationary sports to be imported successfully

-- Drop the existing constraint
ALTER TABLE activities DROP CONSTRAINT IF EXISTS activities_moving_time_check;

-- Add the new constraint that allows >= 0 instead of > 0
ALTER TABLE activities ADD CONSTRAINT activities_moving_time_check
    CHECK (moving_time >= 0);

-- Verify the constraint was updated
SELECT conname, pg_get_constraintdef(oid)
FROM pg_constraint
WHERE conrelid = 'activities'::regclass
    AND conname = 'activities_moving_time_check';