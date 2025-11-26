# Cloud Run Deployment Guide
## Strava Sync Service

This guide walks you through deploying the Strava sync service to Google Cloud Run.

## Prerequisites

1. Google Cloud Project with billing enabled
2. gcloud CLI installed and configured
3. Docker installed (for local testing)
4. Supabase project with database
5. Strava API application credentials

## Step 1: Apply Database Migration

Before deploying, apply the database migration to add OAuth and job tracking tables:

```bash
# Connect to your Supabase database
psql "your-supabase-connection-string"

# Run migration
\i scripts/database/migrations/001_add_oauth_and_jobs_tables.sql
```

Alternatively, run it via Supabase SQL editor.

## Step 2: Configure Environment Variables

Create a `config/.env` file (for local testing):

```bash
# Supabase
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_KEY=your-service-role-key

# Strava OAuth
STRAVA_CLIENT_ID=your-client-id
STRAVA_CLIENT_SECRET=your-client-secret
OAUTH_REDIRECT_URI=https://your-service.run.app/api/oauth/callback

# Optional
NODE_ENV=production
LOG_LEVEL=info
JOB_POLL_INTERVAL=5000
BATCH_SIZE=50
MAX_EXECUTION_TIME=3300000
```

## Step 3: Install Dependencies

```bash
npm install
```

## Step 4: Test Locally (Optional)

```bash
# Run in development mode
npm run dev

# Test endpoints
curl http://localhost:8080/health
```

## Step 5: Enable Google Cloud Services

```bash
# Set your project ID
export PROJECT_ID=your-gcp-project-id
gcloud config set project $PROJECT_ID

# Enable required APIs
gcloud services enable run.googleapis.com
gcloud services enable cloudbuild.googleapis.com
gcloud services enable containerregistry.googleapis.com
```

## Step 6: Deploy to Cloud Run

### Option A: Using Cloud Build (Recommended)

```bash
# Submit build and deploy
gcloud builds submit --config cloudbuild.yaml

# This will:
# 1. Build Docker image
# 2. Push to Container Registry
# 3. Deploy to Cloud Run
```

### Option B: Manual Deployment

```bash
# Build Docker image
docker build -t gcr.io/$PROJECT_ID/strava-sync:latest .

# Push to Container Registry
docker push gcr.io/$PROJECT_ID/strava-sync:latest

# Deploy to Cloud Run
gcloud run deploy strava-sync \
  --image gcr.io/$PROJECT_ID/strava-sync:latest \
  --region us-central1 \
  --platform managed \
  --memory 2Gi \
  --cpu 2 \
  --timeout 60m \
  --max-instances 10 \
  --no-allow-unauthenticated
```

## Step 7: Configure Environment Variables in Cloud Run

```bash
# Set environment variables
gcloud run services update strava-sync \
  --region us-central1 \
  --set-env-vars="SUPABASE_URL=https://your-project.supabase.co" \
  --set-env-vars="SUPABASE_SERVICE_KEY=your-service-key" \
  --set-env-vars="STRAVA_CLIENT_ID=your-client-id" \
  --set-env-vars="STRAVA_CLIENT_SECRET=your-client-secret" \
  --set-env-vars="OAUTH_REDIRECT_URI=https://your-service.run.app/api/oauth/callback" \
  --set-env-vars="NODE_ENV=production"
```

Alternatively, use the Cloud Console UI to set environment variables.

## Step 8: Configure IAM Permissions

### Allow your account to invoke the service:

```bash
gcloud run services add-iam-policy-binding strava-sync \
  --region us-central1 \
  --member="user:your-email@example.com" \
  --role="roles/run.invoker"
```

### For service accounts:

```bash
gcloud run services add-iam-policy-binding strava-sync \
  --region us-central1 \
  --member="serviceAccount:your-sa@project.iam.gserviceaccount.com" \
  --role="roles/run.invoker"
```

## Step 9: Update Strava OAuth Redirect URI

1. Go to https://www.strava.com/settings/api
2. Update "Authorization Callback Domain" to your Cloud Run service URL
3. Example: `your-service-abc123.run.app`

## Step 10: Test the Deployment

### Get service URL:

```bash
gcloud run services describe strava-sync \
  --region us-central1 \
  --format="value(status.url)"
```

### Test health endpoint:

```bash
SERVICE_URL=$(gcloud run services describe strava-sync --region us-central1 --format="value(status.url)")
curl $SERVICE_URL/health
```

## Step 11: Complete OAuth Flow

### Authorize a user:

1. Visit: `https://your-service.run.app/api/oauth/authorize`
2. Authorize with Strava
3. Note the athlete ID from the success page

### Trigger a sync:

```bash
# Get IAM token
TOKEN=$(gcloud auth print-identity-token)

# Create sync job
curl -X POST $SERVICE_URL/api/sync \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"user_id": "YOUR_ATHLETE_ID", "sync_type": "incremental"}'

# Response will include job_id
# Example: {"job_id":"abc-123-def","status":"queued",...}

# Check job status
curl $SERVICE_URL/api/jobs/abc-123-def \
  -H "Authorization: Bearer $TOKEN"
```

## Monitoring and Logs

### View logs:

```bash
gcloud run services logs read strava-sync \
  --region us-central1 \
  --limit 50
```

### Stream logs:

```bash
gcloud run services logs tail strava-sync \
  --region us-central1
```

### View in Cloud Console:

https://console.cloud.google.com/run/detail/us-central1/strava-sync/logs

## Troubleshooting

### Service not starting:

1. Check environment variables are set correctly
2. Verify Supabase connection string
3. Check logs for startup errors

### OAuth flow failing:

1. Verify OAUTH_REDIRECT_URI matches Strava app settings
2. Check Strava API credentials
3. Ensure callback domain is whitelisted in Strava

### Jobs not processing:

1. Check JobWorker logs
2. Verify OAuth tokens are stored in database
3. Check for rate limiting from Strava API

### Database connection issues:

1. Verify Supabase URL and key
2. Check network connectivity from Cloud Run
3. Verify migration was applied

## Updating the Service

To deploy updates:

```bash
# If using Cloud Build
gcloud builds submit --config cloudbuild.yaml

# Or manual
docker build -t gcr.io/$PROJECT_ID/strava-sync:latest .
docker push gcr.io/$PROJECT_ID/strava-sync:latest
gcloud run deploy strava-sync --image gcr.io/$PROJECT_ID/strava-sync:latest --region us-central1
```

Cloud Run will perform a rolling update with zero downtime.

## Cost Optimization

- Cloud Run charges for:
  - CPU and memory while processing requests
  - Container startup time
  - Number of requests

- To minimize costs:
  - Set `--min-instances=0` (default) to scale to zero
  - Use `--concurrency=80` (default) for efficient request handling
  - Monitor job processing times
  - Consider Cloud Scheduler for periodic syncs instead of manual triggers

## Security Best Practices

1. Use IAM authentication (`--no-allow-unauthenticated`)
2. Store secrets in Secret Manager (not environment variables)
3. Enable VPC connector for Supabase private networking
4. Use service accounts with least privilege
5. Enable audit logging
6. Regularly rotate OAuth tokens

## Next Steps

- Set up Cloud Scheduler for automatic syncs
- Add monitoring with Cloud Monitoring
- Configure alerts for failures
- Implement webhook support for real-time Strava events
- Add metrics and dashboards
