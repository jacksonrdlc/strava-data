// ActivitySummarizer.js
// Converts raw activity data into natural language summaries for embedding

const logger = require('../utils/logger');

class ActivitySummarizer {
    /**
     * Convert meters to miles
     */
    static metersToMiles(meters) {
        if (!meters) return null;
        return (meters * 0.000621371).toFixed(2);
    }

    /**
     * Convert meters/second to minutes per mile
     */
    static mpsToMinPerMile(mps) {
        if (!mps || mps === 0) return null;
        const milesPerHour = mps * 2.23694;
        const minutesPerMile = 60 / milesPerHour;
        const minutes = Math.floor(minutesPerMile);
        const seconds = Math.round((minutesPerMile - minutes) * 60);
        return `${minutes}:${seconds.toString().padStart(2, '0')}`;
    }

    /**
     * Convert seconds to readable duration
     */
    static secondsToTime(seconds) {
        if (!seconds) return null;
        const hours = Math.floor(seconds / 3600);
        const minutes = Math.floor((seconds % 3600) / 60);
        const secs = seconds % 60;

        if (hours > 0) {
            return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
        }
        return `${minutes}:${secs.toString().padStart(2, '0')}`;
    }

    /**
     * Determine HR zone (rough estimate based on typical zones)
     * TODO: Make this personalized based on athlete's max HR
     */
    static getHRZone(avgHR, maxHR) {
        if (!avgHR) return null;

        // Rough estimate: Zone 1 (<60%), Z2 (60-70%), Z3 (70-80%), Z4 (80-90%), Z5 (90%+)
        // Assuming max HR around 185 for estimation
        const estimatedMaxHR = maxHR || 185;
        const percentage = (avgHR / estimatedMaxHR) * 100;

        if (percentage < 60) return 'Zone 1 (easy)';
        if (percentage < 70) return 'Zone 2 (aerobic)';
        if (percentage < 80) return 'Zone 3 (tempo)';
        if (percentage < 90) return 'Zone 4 (threshold)';
        return 'Zone 5 (max effort)';
    }

    /**
     * Generate comprehensive activity summary
     */
    static generateSummary(activity) {
        const parts = [];

        // Activity type and name
        if (activity.name) {
            parts.push(activity.name);
        }

        // Date
        const date = new Date(activity.activity_date);
        parts.push(`on ${date.toLocaleDateString('en-US', {
            weekday: 'long',
            month: 'short',
            day: 'numeric',
            year: 'numeric'
        })}`);

        // Distance and time
        const miles = this.metersToMiles(activity.distance);
        const duration = this.secondsToTime(activity.moving_time || activity.elapsed_time);
        if (miles && duration) {
            parts.push(`${miles} miles in ${duration}`);
        }

        // Pace
        const pace = this.mpsToMinPerMile(activity.average_speed);
        if (pace) {
            parts.push(`averaging ${pace}/mile pace`);
        }

        // Heart rate
        if (activity.average_heart_rate) {
            const hrZone = this.getHRZone(activity.average_heart_rate, activity.max_heart_rate);
            parts.push(`HR averaged ${activity.average_heart_rate} bpm (max ${activity.max_heart_rate})${hrZone ? ` in ${hrZone}` : ''}`);
        }

        // Elevation
        if (activity.elevation_gain && activity.elevation_gain > 10) {
            const elevFt = Math.round(activity.elevation_gain * 3.28084);
            parts.push(`with ${elevFt}ft of elevation gain`);
        }

        // Cadence
        if (activity.average_cadence) {
            parts.push(`cadence averaged ${activity.average_cadence} spm`);
        }

        // Power (if available)
        if (activity.average_watts) {
            parts.push(`power averaged ${activity.average_watts}W`);
        }

        // Calories
        if (activity.calories) {
            parts.push(`burned ${activity.calories} calories`);
        }

        // Weather (if available)
        const weatherParts = [];
        if (activity.average_temperature) {
            weatherParts.push(`${activity.average_temperature}°F`);
        }
        if (activity.humidity) {
            weatherParts.push(`${activity.humidity}% humidity`);
        }
        if (activity.weather_condition) {
            weatherParts.push(activity.weather_condition);
        }
        if (activity.wind_speed && activity.wind_speed > 5) {
            weatherParts.push(`${Math.round(activity.wind_speed)} mph wind`);
        }
        if (weatherParts.length > 0) {
            parts.push(`Weather: ${weatherParts.join(', ')}`);
        }

        // Activity flags
        const flags = [];
        if (activity.long_run) flags.push('long run');
        if (activity.competition) flags.push('race');
        if (activity.trainer) flags.push('treadmill');
        if (activity.commute) flags.push('commute');
        if (flags.length > 0) {
            parts.push(`[${flags.join(', ')}]`);
        }

        // Perceived exertion
        if (activity.perceived_exertion) {
            parts.push(`Felt ${activity.perceived_exertion}/10 exertion`);
        }

        return parts.join('. ') + '.';
    }

    /**
     * Generate a more detailed summary for coaching purposes
     */
    static generateDetailedSummary(activity) {
        const summary = this.generateSummary(activity);

        // Add analytical insights
        const insights = [];

        // Pace variability analysis
        if (activity.average_speed && activity.max_speed) {
            const avgMph = activity.average_speed * 2.23694;
            const maxMph = activity.max_speed * 2.23694;
            const variability = ((maxMph - avgMph) / avgMph) * 100;

            if (variability > 50) {
                insights.push('High pace variability suggests intervals or terrain changes');
            } else if (variability < 15) {
                insights.push('Very consistent pacing - good tempo control');
            }
        }

        // HR efficiency analysis
        if (activity.average_heart_rate && activity.average_speed) {
            // This is a simplified efficiency metric
            // TODO: Compare to athlete's historical data for better insights
            const efficiency = activity.average_speed / activity.average_heart_rate;
            insights.push(`Cardiovascular efficiency: ${efficiency.toFixed(4)} m/s per bpm`);
        }

        // Cadence analysis
        if (activity.average_cadence) {
            if (activity.average_cadence < 165) {
                insights.push('Cadence below optimal range (165-180 spm) - consider shorter, quicker steps');
            } else if (activity.average_cadence >= 165 && activity.average_cadence <= 180) {
                insights.push('Cadence in optimal range (165-180 spm)');
            } else {
                insights.push('Cadence above typical range - very quick turnover');
            }
        }

        // Power analysis (if available)
        if (activity.average_watts && activity.distance) {
            const miles = this.metersToMiles(activity.distance);
            const wattsPerMile = activity.average_watts / parseFloat(miles);
            insights.push(`Power efficiency: ${Math.round(wattsPerMile)} watts per mile`);
        }

        if (insights.length > 0) {
            return `${summary}\n\nAnalysis: ${insights.join('. ')}.`;
        }

        return summary;
    }

    /**
     * Generate embedding-optimized summary (more structured, keyword-rich)
     */
    static generateEmbeddingSummary(activity) {
        const parts = [];

        // Start with activity type
        parts.push(`Activity: ${activity.name || 'Run'}`);

        // Date in ISO format for better temporal matching
        parts.push(`Date: ${new Date(activity.activity_date).toISOString().split('T')[0]}`);

        // Distance and duration
        const miles = this.metersToMiles(activity.distance);
        const duration = this.secondsToTime(activity.moving_time || activity.elapsed_time);
        if (miles) parts.push(`Distance: ${miles} miles`);
        if (duration) parts.push(`Duration: ${duration}`);

        // Pace
        const pace = this.mpsToMinPerMile(activity.average_speed);
        if (pace) parts.push(`Pace: ${pace}/mile`);

        // Heart rate
        if (activity.average_heart_rate) {
            parts.push(`Heart Rate: ${activity.average_heart_rate} bpm avg, ${activity.max_heart_rate} bpm max`);
        }

        // Elevation
        if (activity.elevation_gain) {
            const elevFt = Math.round(activity.elevation_gain * 3.28084);
            parts.push(`Elevation Gain: ${elevFt}ft`);
        }

        // Cadence
        if (activity.average_cadence) {
            parts.push(`Cadence: ${activity.average_cadence} spm`);
        }

        // Power
        if (activity.average_watts) {
            parts.push(`Power: ${activity.average_watts}W avg`);
        }

        // Weather
        if (activity.average_temperature) {
            parts.push(`Temperature: ${activity.average_temperature}°F`);
        }
        if (activity.humidity) {
            parts.push(`Humidity: ${activity.humidity}%`);
        }

        // Flags
        const flags = [];
        if (activity.long_run) flags.push('long_run');
        if (activity.competition) flags.push('race');
        if (activity.trainer) flags.push('treadmill');
        if (flags.length > 0) {
            parts.push(`Tags: ${flags.join(', ')}`);
        }

        return parts.join('. ') + '.';
    }
}

module.exports = ActivitySummarizer;
