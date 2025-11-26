-- Migration: Add map data fields to activities table
-- Created: 2025-09-29
-- Description: Adds polyline, summary_polyline, and start/end coordinates to activities table

-- Add map data fields
ALTER TABLE activities ADD COLUMN IF NOT EXISTS map_polyline TEXT;
ALTER TABLE activities ADD COLUMN IF NOT EXISTS map_summary_polyline TEXT;

-- Add location data fields
ALTER TABLE activities ADD COLUMN IF NOT EXISTS start_latitude DECIMAL(10, 7);
ALTER TABLE activities ADD COLUMN IF NOT EXISTS start_longitude DECIMAL(10, 7);
ALTER TABLE activities ADD COLUMN IF NOT EXISTS end_latitude DECIMAL(10, 7);
ALTER TABLE activities ADD COLUMN IF NOT EXISTS end_longitude DECIMAL(10, 7);

-- Create index for geospatial queries (optional but recommended)
CREATE INDEX IF NOT EXISTS idx_activities_start_location ON activities(start_latitude, start_longitude);
CREATE INDEX IF NOT EXISTS idx_activities_end_location ON activities(end_latitude, end_longitude);

-- Add comment for documentation
COMMENT ON COLUMN activities.map_polyline IS 'Full resolution encoded polyline from Strava API';
COMMENT ON COLUMN activities.map_summary_polyline IS 'Simplified polyline for overview display from Strava API';
COMMENT ON COLUMN activities.start_latitude IS 'Starting latitude in decimal degrees';
COMMENT ON COLUMN activities.start_longitude IS 'Starting longitude in decimal degrees';
COMMENT ON COLUMN activities.end_latitude IS 'Ending latitude in decimal degrees';
COMMENT ON COLUMN activities.end_longitude IS 'Ending longitude in decimal degrees';