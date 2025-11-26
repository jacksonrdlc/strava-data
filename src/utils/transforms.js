// transforms.js
// Data transformation utilities for Strava API responses
// Converts Strava API activity format to database schema

/**
 * Map Strava activity type to database activity_type_id
 */
function getActivityTypeId(stravaType) {
    const typeMap = {
        'Run': 103,
        'Ride': 104,
        'Walk': 105,
        'Hike': 106,
        'VirtualRide': 107,
        'VirtualRun': 108,
        'Swim': 109,
        'Workout': 110,
        'WeightTraining': 111,
        'Yoga': 112,
        'Crossfit': 113,
        'Elliptical': 114,
        'Rowing': 115,
        'RockClimbing': 116,
        'AlpineSki': 117,
        'Snowboard': 118,
        'MountainBikeRide': 119,
        'GravelRide': 120,
        'TrailRun': 121,
        'Golf': 123
    };
    return typeMap[stravaType] || null;
}

/**
 * Transform Strava API activity to database format
 */
function transformApiActivity(apiActivity, athleteId) {
    return {
        id: apiActivity.id,
        athlete_id: athleteId,
        activity_type_id: getActivityTypeId(apiActivity.type),
        name: apiActivity.name || 'Untitled Activity',
        description: apiActivity.description || '',

        // Dates
        activity_date: apiActivity.start_date,
        start_time: apiActivity.start_date_local || apiActivity.start_date,

        // Times (API provides in seconds) - ensure integers
        elapsed_time: parseInt(apiActivity.elapsed_time) || 0,
        moving_time: parseInt(apiActivity.moving_time) || 0,

        // Distance (API provides in meters) - ensure float
        distance: parseFloat(apiActivity.distance) || 0,

        // Speed metrics (API provides in m/s) - ensure float
        average_speed: parseFloat(apiActivity.average_speed) || 0,
        max_speed: parseFloat(apiActivity.max_speed) || 0,

        // Elevation (API provides in meters) - ensure float
        elevation_gain: parseFloat(apiActivity.total_elevation_gain) || 0,
        elevation_high: apiActivity.elev_high ? parseFloat(apiActivity.elev_high) : null,
        elevation_low: apiActivity.elev_low ? parseFloat(apiActivity.elev_low) : null,

        // Cadence - ensure integers or null
        max_cadence: apiActivity.max_cadence ? parseInt(apiActivity.max_cadence) : null,
        average_cadence: apiActivity.average_cadence ? parseInt(apiActivity.average_cadence) : null,

        // Heart rate - ensure integers or null
        max_heart_rate: apiActivity.max_heartrate ? parseInt(apiActivity.max_heartrate) : null,
        average_heart_rate: apiActivity.average_heartrate ? parseInt(apiActivity.average_heartrate) : null,
        has_heartrate: Boolean(apiActivity.has_heartrate),

        // Power - ensure integers or null
        average_watts: apiActivity.average_watts ? parseInt(apiActivity.average_watts) : null,
        max_watts: apiActivity.max_watts ? parseInt(apiActivity.max_watts) : null,
        weighted_average_watts: apiActivity.weighted_average_watts ? parseInt(apiActivity.weighted_average_watts) : null,
        device_watts: Boolean(apiActivity.device_watts),

        // Other metrics
        calories: apiActivity.calories ? parseInt(apiActivity.calories) : null,
        average_temperature: apiActivity.average_temp ? parseInt(apiActivity.average_temp) : null,

        // Map data (encoded polylines)
        map_polyline: apiActivity.map?.polyline || null,
        map_summary_polyline: apiActivity.map?.summary_polyline || null,

        // Location data (start/end coordinates)
        start_latitude: apiActivity.start_latlng?.[0] || null,
        start_longitude: apiActivity.start_latlng?.[1] || null,
        end_latitude: apiActivity.end_latlng?.[0] || null,
        end_longitude: apiActivity.end_latlng?.[1] || null,

        // Flags
        commute: apiActivity.commute || false,
        from_upload: apiActivity.upload_id ? true : false,
        flagged: apiActivity.flagged || false,
        trainer: apiActivity.trainer || false,
        manual: apiActivity.manual || false,
        private: apiActivity.private || false,

        // Gear
        gear_id: apiActivity.gear_id || null,

        // File reference
        filename: null, // API doesn't provide original filename
        external_id: apiActivity.external_id || null,
        resource_state: apiActivity.resource_state || 2
    };
}

/**
 * Transform Strava athlete data to database format
 */
function transformAthleteData(apiAthlete) {
    return {
        id: apiAthlete.id,
        username: apiAthlete.username || null,
        first_name: apiAthlete.firstname || null,
        last_name: apiAthlete.lastname || null,
        city: apiAthlete.city || null,
        state: apiAthlete.state || null,
        country: apiAthlete.country || null,
        sex: apiAthlete.sex || null,
        premium: apiAthlete.premium || false,
        summit: apiAthlete.summit || false,
        created_at: apiAthlete.created_at || null,
        updated_at: apiAthlete.updated_at || null,
        follower_count: apiAthlete.follower_count || null,
        friend_count: apiAthlete.friend_count || null,
        resource_state: apiAthlete.resource_state || 2
    };
}

/**
 * Convert Unix timestamp (seconds) to ISO date string
 */
function unixToISO(timestamp) {
    if (!timestamp) return null;
    return new Date(timestamp * 1000).toISOString();
}

/**
 * Convert ISO date string to Unix timestamp (seconds)
 */
function isoToUnix(isoString) {
    if (!isoString) return null;
    return Math.floor(new Date(isoString).getTime() / 1000);
}

module.exports = {
    transformApiActivity,
    transformAthleteData,
    getActivityTypeId,
    unixToISO,
    isoToUnix
};
