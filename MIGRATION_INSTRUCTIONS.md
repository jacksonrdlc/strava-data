# Database Migration Instructions

## Add Map Data Fields to Activities Table

**Date:** 2025-09-29
**Purpose:** Add map polylines and location coordinates to support route visualization

### Steps to Apply Migration

1. **Open Supabase Dashboard**
   - Go to your Supabase project dashboard
   - Navigate to the SQL Editor section

2. **Run the Following SQL**

```sql
-- Migration: Add map data fields to activities table
-- Created: 2025-09-29

-- Add map data fields
ALTER TABLE activities ADD COLUMN IF NOT EXISTS map_polyline TEXT;
ALTER TABLE activities ADD COLUMN IF NOT EXISTS map_summary_polyline TEXT;

-- Add location data fields
ALTER TABLE activities ADD COLUMN IF NOT EXISTS start_latitude DECIMAL(10, 7);
ALTER TABLE activities ADD COLUMN IF NOT EXISTS start_longitude DECIMAL(10, 7);
ALTER TABLE activities ADD COLUMN IF NOT EXISTS end_latitude DECIMAL(10, 7);
ALTER TABLE activities ADD COLUMN IF NOT EXISTS end_longitude DECIMAL(10, 7);

-- Create indexes for geospatial queries
CREATE INDEX IF NOT EXISTS idx_activities_start_location ON activities(start_latitude, start_longitude);
CREATE INDEX IF NOT EXISTS idx_activities_end_location ON activities(end_latitude, end_longitude);

-- Add documentation comments
COMMENT ON COLUMN activities.map_polyline IS 'Full resolution encoded polyline from Strava API';
COMMENT ON COLUMN activities.map_summary_polyline IS 'Simplified polyline for overview display from Strava API';
COMMENT ON COLUMN activities.start_latitude IS 'Starting latitude in decimal degrees';
COMMENT ON COLUMN activities.start_longitude IS 'Starting longitude in decimal degrees';
COMMENT ON COLUMN activities.end_latitude IS 'Ending latitude in decimal degrees';
COMMENT ON COLUMN activities.end_longitude IS 'Ending longitude in decimal degrees';
```

3. **Verify Migration**

After running the migration, verify it with:

```sql
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'activities'
  AND column_name IN ('map_polyline', 'map_summary_polyline', 'start_latitude', 'start_longitude', 'end_latitude', 'end_longitude');
```

You should see all 6 new columns listed.

4. **Run Backfill Script**

After the migration is applied, run:

```bash
npm run backfill-maps
```

This will fetch map data from Strava API for all existing activities.

## What These Fields Store

- **map_polyline**: Encoded polyline string (Google Polyline Format) with full route detail
- **map_summary_polyline**: Simplified polyline for map overview/thumbnail display
- **start_latitude/longitude**: Starting coordinates of the activity
- **end_latitude/longitude**: Ending coordinates of the activity

## Rollback (if needed)

To remove these fields:

```sql
ALTER TABLE activities DROP COLUMN IF EXISTS map_polyline;
ALTER TABLE activities DROP COLUMN IF EXISTS map_summary_polyline;
ALTER TABLE activities DROP COLUMN IF EXISTS start_latitude;
ALTER TABLE activities DROP COLUMN IF EXISTS start_longitude;
ALTER TABLE activities DROP COLUMN IF EXISTS end_latitude;
ALTER TABLE activities DROP COLUMN IF EXISTS end_longitude;
DROP INDEX IF EXISTS idx_activities_start_location;
DROP INDEX IF EXISTS idx_activities_end_location;
```