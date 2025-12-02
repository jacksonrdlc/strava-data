# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a dual-purpose Strava data management system:
1. **CSV Import Utility**: ETL script to import Strava activity export data (CSV) into Supabase
2. **Cloud Run Service**: Production API service for OAuth-based activity syncing via Strava API

## Commands

### Local Development & CSV Import
```bash
npm install                  # Install dependencies
npm run import               # Import activities from CSV (data/activities.csv)
npm run import-all           # Import all data types from CSV
npm run import-simple        # Simple import without foreign keys
npm run lint                 # Run ESLint
```

### Cloud Run Service (Production)
```bash
npm start                    # Start production server (Cloud Run)
npm run dev                  # Start development server with NODE_ENV=development
```

### Database Management Scripts
```bash
npm run read-tables                  # Read and display database tables
npm run analyze-failures             # Analyze import/sync failures
npm run fix-constraints              # Fix database constraint issues
npm run check-connections            # Check athlete connections
npm run fix-athlete-connections      # Fix athlete connection issues
npm run fix-activity-types           # Fix missing activity type references
```

### Strava API Operations
```bash
npm run strava-setup         # Interactive OAuth setup and token management
npm run strava-fetch         # Fetch all activities from Strava API
npm run strava-sync          # Sync activities from Strava to database
npm run strava-compare       # Compare CSV data with API data
npm run backfill-maps        # Backfill map data for activities
```

### Google Cloud Deployment
```bash
# Build and deploy to Cloud Run
gcloud builds submit --config cloudbuild.yaml

# Build without deploying
gcloud builds submit --config cloudbuild-build-only.yaml

# View build logs
gcloud builds log [BUILD_ID]

# View Cloud Run logs
gcloud logging read "resource.type=cloud_run_revision AND resource.labels.service_name=strava-sync"

# Manage secrets
gcloud secrets list
gcloud secrets versions access latest --secret="STRAVA_CLIENT_ID"
gcloud secrets create STRAVA_CLIENT_ID --data-file=-
gcloud secrets versions add STRAVA_CLIENT_ID --data-file=-
```

## Architecture

### Two Operational Modes

**1. CSV Import Scripts** (`scripts/import/`)
- One-time ETL process for historical data migration
- Parses `data/activities.csv` from Strava bulk export
- Transforms CSV schema to database schema
- Batch upserts with 50-record batches

**2. Cloud Run Service** (`src/`)
- Production API deployed on Google Cloud Run
- OAuth 2.0 integration with Strava API
- Background job worker for async activity syncing
- Handles incremental syncs and full backfills

### Cloud Run Service Architecture

**Service Initialization Flow** (src/server.js):
1. Express app initialization
2. DatabaseClient (Supabase) initialization
3. TokenManager (OAuth token lifecycle) initialization
4. JobWorker (background processor) starts polling
5. Routes mounted with authentication middleware

**Key Services**:
- **DatabaseClient** (`src/services/DatabaseClient.js`): Supabase client wrapper, provides methods for OAuth tokens, sync jobs, activities, athletes
- **TokenManager** (`src/services/TokenManager.js`): Manages OAuth token lifecycle, handles token expiration and refresh (5-minute buffer before expiry)
- **JobWorker** (`src/services/JobWorker.js`): Background worker that polls `sync_jobs` table, processes queued jobs by creating StravaClient instances
- **JobProcessor** (`src/services/JobProcessor.js`): Core sync business logic, checkpoint-based resumption for long-running jobs, fetches from Strava API, transforms, and inserts to database
- **StravaClient** (`src/services/StravaClient.js`): Axios wrapper for Strava API v3 with rate limiting

**Job Processing Flow**:
1. Client POSTs to `/api/sync` → creates record in `sync_jobs` table (status: queued)
2. JobWorker polls database every N seconds (configurable via JOB_POLL_INTERVAL)
3. JobWorker picks up queued job → changes status to "processing"
4. JobProcessor fetches activities from Strava API (paginated)
5. Transforms API response to database schema via `transformApiActivity()`
6. Batch inserts to database
7. Updates job status to "completed" or "failed"
8. JobWorker continues polling for next job

**Authentication**:
- OAuth flow: `/api/oauth/authorize` → Strava → `/api/oauth/callback`
- API routes protected by IAM in production (Cloud Run IAM authentication)
- Development mode: `NODE_ENV=development` skips authentication
- Service uses both IAM (platform level) and custom auth middleware

**Routes**:
- `/health`: Health check (no auth)
- `/api/oauth/*`: OAuth authorization flow (no auth for callbacks)
- `/api/sync`: Create sync job (IAM auth)
- `/api/sync-beta`: Create limited sync job (max 20 activities, IAM auth)
- `/api/jobs/:jobId`: Get job status (IAM auth)

### Database Schema

Schema defined in `scripts/database/schema/create_supabase_database.sql`.

**Core Tables**:
- `athletes`: User profiles (Strava athlete records), linked to Supabase auth.users
- `activities`: Main activity data with metrics, timing, location
- `gear`: Equipment (bikes, shoes), linked to athletes
- `activity_types`: Reference table for activity types (Run, Ride, Swim, etc.)
- `oauth_tokens`: OAuth access/refresh tokens per athlete
- `sync_jobs`: Background job queue and status tracking

**Important Constraints**:
- All activities require valid `athlete_id` (foreign key to athletes table)
- Activity types are referenced via `activity_type_id` (foreign key to activity_types table)
- Gear is optional via `gear_id` (foreign key to gear table)
- Database uses CHECK constraints for data validation (e.g., heart rate 0-300, humidity 0-100)

### Data Transformation

**CSV Import**: `csvRowToActivity()` in `scripts/import/strava-csv-import.js`
- Maps CSV column names to database fields
- Converts distances to meters (CSV may have km)
- Parses date strings to ISO timestamps
- Handles missing/null values with safe defaults

**API Import**: `transformApiActivity()` in `src/utils/transforms.js`
- Maps Strava API v3 response to database schema
- Converts nested objects (e.g., `map.summary_polyline`)
- Handles unit conversions (API uses meters, m/s)
- Preserves API-specific fields (resource_state, external_id, upload_id)

### Configuration

**Environment Variables** (config/.env):
```
SUPABASE_URL=https://[project-id].supabase.co
SUPABASE_SERVICE_KEY=[service-role-key]
STRAVA_CLIENT_ID=[oauth-client-id]
STRAVA_CLIENT_SECRET=[oauth-client-secret]
OAUTH_REDIRECT_URI=https://[your-domain]/api/oauth/callback
PORT=8080  # Cloud Run provides this
NODE_ENV=production  # development to skip auth
```

**Hardcoded Constants** (src/utils/constants.js):
- `BATCH_SIZE`: 50 (records per database batch insert)
- `JOB_POLL_INTERVAL`: Polling frequency for background worker
- `MAX_EXECUTION_TIME`: Max time for single job execution
- `STRAVA.API_BASE_URL`: https://www.strava.com/api/v3
- `STRAVA.RATE_LIMIT`: API rate limiting configuration

### Docker & Cloud Run

**Multi-stage Dockerfile**:
- Stage 1: Builder (installs all dependencies)
- Stage 2: Production (copies source, installs production deps only)
- Runs as non-root `node` user
- Health check on `/health` endpoint
- Listens on PORT env var (Cloud Run provides 8080)

**Cloud Build** (cloudbuild.yaml):
- Builds Docker image and pushes to GCR
- Deploys to Cloud Run with:
  - 2Gi memory, 2 CPU
  - 60m timeout (for long-running sync jobs)
  - Max 10 instances, min 0 (scales to zero)
  - Concurrency: 80
  - Secrets from Secret Manager (Supabase key, Strava credentials)

**Graceful Shutdown**:
- Handles SIGTERM/SIGINT for graceful shutdown
- Stops accepting new requests
- JobWorker completes current job before shutdown
- 30-second timeout before forced exit

## Development Context

This project evolved from a simple CSV import utility into a production-ready Cloud Run service. The CSV import scripts remain for initial data migration, while the Cloud Run service handles ongoing syncs via OAuth. Both modes share the same database schema and transformation logic patterns.

When working with sync jobs, note that JobProcessor implements checkpoint-based resumption (`last_processed_page` in job metadata), allowing jobs to resume after timeout or failure without reprocessing activities.
