# Strava API to Supabase Database Field Mapping Analysis

## Executive Summary

**YES, there are mismatches** between what the Strava API returns and what you're storing in your Supabase database. Below is a comprehensive analysis of missing fields, type mismatches, and recommendations.

---

## Critical Missing Fields from Strava API

### 1. **Map Data (HIGH PRIORITY)**
**Strava API Returns:**
- `map.polyline` - Full resolution encoded polyline
- `map.summary_polyline` - Simplified polyline for overview

**Your Database Has:**
- ✅ `map_polyline` (activities:194)
- ✅ `map_summary_polyline` (activities:195)

**Your Import Script:**
- ❌ **NOT BEING MAPPED** in `import-all-data.js:291-363`

**Impact:** You're losing all GPS route data from Strava activities.

---

### 2. **Location Coordinates (HIGH PRIORITY)**
**Strava API Returns:**
- `start_latlng` - Array [latitude, longitude]
- `end_latlng` - Array [latitude, longitude]

**Your Database Has:**
- ✅ `start_latitude` (activities:198)
- ✅ `start_longitude` (activities:199)
- ✅ `end_latitude` (activities:200)
- ✅ `end_longitude` (activities:201)

**Your Import Script:**
- ❌ **NOT BEING MAPPED** in `import-all-data.js:291-363`

**Impact:** You're losing start/end location data that could be used for maps and location-based queries.

---

### 3. **Social Engagement Metrics (MEDIUM PRIORITY)**
**Strava API Returns:**
- `kudos_count` - Number of kudos received
- `comment_count` - Number of comments
- `athlete_count` - Number of athletes who participated
- `photo_count` - Number of photos
- `total_photo_count` - Total photos including from other athletes
- `achievement_count` - Number of achievements earned
- `pr_count` - Number of personal records

**Your Database Has:**
- ❌ **NONE OF THESE FIELDS**

**Impact:** You can't track engagement metrics, achievements, or PRs from the API.

---

### 4. **Activity Type Evolution (MEDIUM PRIORITY)**
**Strava API Returns:**
- `type` - Legacy activity type (e.g., "Run")
- `sport_type` - New detailed sport type (e.g., "TrailRun")

**Your Database Has:**
- ✅ `activity_type_id` (references activity_types table)

**Your Import Script:**
- ✅ Maps `activity_type` correctly
- ❌ Doesn't capture `sport_type`

**Impact:** Missing new granular sport categorization (Trail Run vs Road Run, etc.)

---

### 5. **Device and Upload Metadata (LOW PRIORITY)**
**Strava API Returns:**
- `external_id` - External identifier from device
- `upload_id` - Strava's upload identifier
- `device_watts` - Whether power came from device
- `manual` - Whether manually created
- `trainer` - Whether on indoor trainer
- `private` - Privacy status

**Your Database Has:**
- ✅ `external_id` (activities:206)
- ✅ `device_watts` (activities:131)
- ✅ `manual` (activities:166)
- ✅ `trainer` (activities:165)
- ✅ `private` (activities:167)
- ❌ `upload_id` - **MISSING**

**Your Import Script:**
- ❌ **NOT MAPPING** any of these except `from_upload`

---

### 6. **Timezone and UTC Offset (MEDIUM PRIORITY)**
**Strava API Returns:**
- `timezone` - IANA timezone (e.g., "(GMT-08:00) America/Los_Angeles")
- `utc_offset` - UTC offset in seconds
- `start_date` - UTC timestamp
- `start_date_local` - Local timestamp

**Your Database Has:**
- ❌ No timezone fields

**Your Import Script:**
- ❌ Not capturing timezone data

**Impact:** Can't properly handle activities across timezones or display local times.

---

### 7. **Advanced Metrics (LOW PRIORITY)**
**Strava API Returns:**
- `suffer_score` - Strava's proprietary effort metric (nullable)
- `workout_type` - Type of workout (nullable)
- `kilojoules` - Energy expended
- `has_kudoed` - Whether current user kudoed this

**Your Database Has:**
- ❌ `suffer_score` - **MISSING**
- ❌ `workout_type` - **MISSING**
- ❌ `kilojoules` - **MISSING**

---

### 8. **Nested Objects Not Being Captured**
**Strava API Returns:**
- `segment_efforts[]` - Array of segment efforts
- `splits_metric[]` - Metric splits (km)
- `splits_standard[]` - Standard splits (miles)
- `laps[]` - Lap data
- `photos` - Photos summary object
- `gear` - Gear object (not just ID)

**Your Database:**
- Segment efforts would need separate table
- Splits/laps need separate tables
- Currently only storing gear_id

---

## Type Mismatches

### 1. **Decimal Precision**
**Issue:** Strava returns floats, your DB uses DECIMAL with specific precision

Example:
```javascript
// Strava API
distance: 5234.5 (Float - meters)

// Your DB Schema
distance DECIMAL(12,2)  // Can store 5234.50
```

**Status:** ✅ Generally OK, but watch for edge cases with very long distances

### 2. **Integer vs Float for Cadence**
**Strava API:** `average_cadence: Float`
**Your DB:** `average_cadence: INTEGER`

**Impact:** Minor - losing decimal precision on cadence

### 3. **Calories Type**
**Strava API:** `calories: Float`
**Your DB:** `calories: INTEGER`

**Impact:** Minor - losing decimal calories (rarely significant)

---

## CSV Import vs API Import Discrepancies

### Fields in CSV but NOT in API:
Your CSV has extensive weather data that the Strava API DetailedActivity model doesn't include in the standard response:
- `weather_observation_time`
- `weather_condition`
- `weather_temperature`
- `apparent_temperature`
- `dewpoint`
- `humidity`
- `weather_pressure`
- `wind_speed`, `wind_gust`, `wind_bearing`
- `precipitation_*`
- `sunrise_time`, `sunset_time`
- `moon_phase`
- `cloud_cover`, `weather_visibility`, `uv_index`, `weather_ozone`

**Note:** Strava API only provides `average_temp` for temperature.

### Fields in API but NOT in CSV:
- `kudos_count`, `comment_count`, `athlete_count`
- `achievement_count`, `pr_count`
- `map` polylines
- `start_latlng`, `end_latlng`
- `segment_efforts`, `splits`, `laps`
- `sport_type`
- `timezone`, `utc_offset`

---

## Recommendations

### Priority 1: Add Missing Map Data
```javascript
// In import-all-data.js line ~304
const activity = {
    // ... existing fields ...
    map_polyline: row.map?.polyline || null,
    map_summary_polyline: row.map?.summary_polyline || null,
    start_latitude: row.start_latlng?.[0] || null,
    start_longitude: row.start_latlng?.[1] || null,
    end_latitude: row.end_latlng?.[0] || null,
    end_longitude: row.end_latlng?.[1] || null,
};
```

### Priority 2: Add Social Engagement Fields
Update database schema:
```sql
ALTER TABLE activities ADD COLUMN kudos_count INTEGER CHECK (kudos_count >= 0);
ALTER TABLE activities ADD COLUMN comment_count INTEGER CHECK (comment_count >= 0);
ALTER TABLE activities ADD COLUMN athlete_count INTEGER CHECK (athlete_count >= 0);
ALTER TABLE activities ADD COLUMN photo_count INTEGER CHECK (photo_count >= 0);
ALTER TABLE activities ADD COLUMN achievement_count INTEGER CHECK (achievement_count >= 0);
ALTER TABLE activities ADD COLUMN pr_count INTEGER CHECK (pr_count >= 0);
```

### Priority 3: Add Timezone Support
```sql
ALTER TABLE activities ADD COLUMN timezone VARCHAR(100);
ALTER TABLE activities ADD COLUMN utc_offset INTEGER;
ALTER TABLE activities ADD COLUMN start_date_local TIMESTAMPTZ;
```

### Priority 4: Add Sport Type
```sql
ALTER TABLE activities ADD COLUMN sport_type VARCHAR(50);
```

### Priority 5: Add Advanced Metrics
```sql
ALTER TABLE activities ADD COLUMN suffer_score DECIMAL(8,2);
ALTER TABLE activities ADD COLUMN workout_type INTEGER;
ALTER TABLE activities ADD COLUMN kilojoules DECIMAL(10,2);
ALTER TABLE activities ADD COLUMN upload_id BIGINT;
```

---

## Current Import Script Issues

**File:** `scripts/import/import-all-data.js:291-363`

**Problems:**
1. Only maps ~30 fields from CSV rows
2. Doesn't handle nested objects from API (map, gear, etc.)
3. Doesn't extract lat/lng from arrays
4. Doesn't capture engagement metrics
5. Hard-codes some conversions (distance) that may not be needed for API data

---

## Summary Table

| Field Category | Strava API Has | DB Schema Has | Import Script Maps | Priority |
|----------------|----------------|---------------|-------------------|----------|
| Map Polylines | ✅ | ✅ | ❌ | HIGH |
| Start/End Coords | ✅ | ✅ | ❌ | HIGH |
| Kudos/Comments | ✅ | ❌ | ❌ | MEDIUM |
| Sport Type | ✅ | ❌ | ❌ | MEDIUM |
| Timezone | ✅ | ❌ | ❌ | MEDIUM |
| Suffer Score | ✅ | ❌ | ❌ | LOW |
| Upload ID | ✅ | ❌ | ❌ | LOW |
| Device Flags | ✅ | ✅ | ❌ | LOW |

---

## Next Steps

1. **Decide on data source:** CSV export vs API calls
   - CSV has weather data API doesn't
   - API has real-time data and engagement metrics

2. **Update database schema** to add missing columns (see Priority 2-5 above)

3. **Update import script** to map API response fields properly

4. **Test with a single activity** to verify field mapping

5. **Consider hybrid approach:** Use CSV for historical weather, use API for ongoing sync
