# Athlete Memory System Design

## Overview
Persistent AI memory that learns about each athlete over time through conversations and activity analysis.

## Memory Schema (core_memory JSONB)

```json
{
  "athlete_id": 94451852,
  "created_at": "2025-12-01T...",
  "updated_at": "2025-12-01T...",

  "personal": {
    "name": "Jack",
    "preferred_name": "Jack",
    "age_range": "30-40",
    "experience_level": "intermediate"
  },

  "goals": {
    "primary": "Complete a marathon under 4 hours",
    "secondary": ["Build consistent weekly mileage", "Improve pace"],
    "race_schedule": [
      {
        "event": "SF Marathon",
        "date": "2025-07-20",
        "distance": "marathon",
        "goal_time": "3:59:00"
      }
    ]
  },

  "training_preferences": {
    "coaching_style": "supportive",
    "verbosity": "concise",
    "preferred_units": "miles",
    "preferred_workout_days": ["Tuesday", "Thursday", "Saturday"],
    "typical_workout_time": "morning"
  },

  "physical_profile": {
    "injuries_history": [
      {
        "type": "IT band syndrome",
        "date": "2024-03",
        "status": "recovered",
        "notes": "Triggered by sudden mileage increase"
      }
    ],
    "current_concerns": [],
    "strengths": ["Consistent weekly mileage", "Good pacing discipline"],
    "areas_to_improve": ["Hill training", "Speed work"]
  },

  "patterns_observed": {
    "typical_weekly_mileage": 35,
    "long_run_day": "Saturday",
    "preferred_pace": "10:30-11:00 min/mile",
    "hr_zones": {
      "zone_2": "135-145 bpm",
      "zone_3": "145-160 bpm",
      "zone_4": "160-170 bpm"
    },
    "performance_trends": {
      "recent": "Improving pace consistency",
      "monthly": "Building volume safely"
    }
  },

  "key_conversations": [
    {
      "date": "2025-11-15",
      "topic": "Discussed marathon training plan",
      "key_points": ["Prefers 16-week plan", "Can run 4x per week"]
    },
    {
      "date": "2025-11-28",
      "topic": "Asked about recovery after long runs",
      "key_points": ["Concerned about fatigue", "Interested in nutrition"]
    }
  ],

  "milestone_achievements": [
    {
      "date": "2025-11-18",
      "achievement": "Longest run: 13.51 miles",
      "significance": "First run over 13 miles"
    }
  ]
}
```

## Memory Extraction Strategy

### When to Update Memory
- **After every conversation**: Extract new insights from the conversation
- **Merge, don't overwrite**: Intelligently merge new information with existing memory
- **Track update timestamps**: Know when each memory section was last updated

### What to Extract
1. **Explicit Information**: Direct statements ("I'm training for a marathon")
2. **Implicit Patterns**: Behavioral patterns from activity data
3. **Goals & Intentions**: Training goals, race plans, improvement areas
4. **Concerns & Preferences**: Injuries, preferences, coaching style
5. **Milestones**: Achievements, PRs, breakthroughs

### Memory Extraction Process
```
1. User + Assistant conversation
2. Call Claude with specialized "memory extraction" prompt
3. Claude returns structured updates to memory
4. Merge updates into existing core_memory
5. Save to database
```

## Implementation Plan

### 1. Memory Extraction Service
Create `MemoryService.js`:
- `extractMemoryFromConversation(athleteId, userMessage, assistantResponse, activityContext)`
- `mergeMemoryUpdate(existingMemory, updates)`
- `updateAthleteMemory(athleteId, memoryUpdates)`

### 2. Update ChatService
- After generating response, extract memory updates
- Merge with existing profile
- Save asynchronously (don't block response)

### 3. Include Memory in Chat Context
- Load athlete profile at start of conversation
- Include relevant memory sections in prompt:
  - Personal info
  - Current goals
  - Recent concerns/injuries
  - Training preferences
  - Key patterns

### 4. Memory-Aware Prompting
Update prompt format:
```
ATHLETE PROFILE:
- Name: Jack
- Experience: Intermediate runner
- Current Goal: Marathon under 4:00
- Known Concerns: Previously dealt with IT band issues
- Preferences: Prefers concise, supportive coaching

[rest of context...]
```

## Benefits
1. **Personalized Coaching**: Claude remembers athlete's history, goals, concerns
2. **Better Context**: Don't repeat questions athlete already answered
3. **Longitudinal Insights**: Track progress and patterns over time
4. **Efficient Conversations**: Skip re-explaining context each time
5. **Trust Building**: Athlete feels "known" and understood

## Privacy & Data Handling
- Memory stored in athlete's own database row
- Only accessible by athlete
- Can be cleared/reset by athlete
- No cross-athlete data sharing
