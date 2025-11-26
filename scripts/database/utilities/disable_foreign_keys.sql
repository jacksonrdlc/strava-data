-- Disable foreign key constraints for data import
-- Run this BEFORE your import to bypass all foreign key checks

-- Method 1: Disable all foreign key constraints in the session
SET session_replication_role = replica;

-- This disables ALL triggers and constraints including foreign keys
-- for the current session only (safest approach)

-- Show current setting
SHOW session_replication_role;