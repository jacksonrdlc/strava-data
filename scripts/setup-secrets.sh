#!/bin/bash
# Setup secrets in Google Cloud Secret Manager for Strava Sync service

set -e

echo "🔐 Setting up secrets in Google Cloud Secret Manager"
echo ""

# Check if secrets exist, if not create them
create_secret_if_missing() {
    local secret_name=$1
    local prompt_message=$2

    if gcloud secrets describe "$secret_name" &>/dev/null; then
        echo "✓ Secret '$secret_name' already exists"
    else
        echo "Creating secret '$secret_name'"
        read -p "$prompt_message: " secret_value
        echo -n "$secret_value" | gcloud secrets create "$secret_name" --data-file=-
        echo "✓ Created secret '$secret_name'"
    fi
}

# Create Strava secrets
echo "📍 Strava API Credentials"
echo "Get these from: https://www.strava.com/settings/api"
echo ""

create_secret_if_missing "STRAVA_CLIENT_ID" "Enter your Strava Client ID"
create_secret_if_missing "STRAVA_CLIENT_SECRET" "Enter your Strava Client Secret"

# Create OAuth redirect URI (will be updated after deployment)
echo ""
echo "📍 OAuth Redirect URI"
if gcloud secrets describe "OAUTH_REDIRECT_URI" &>/dev/null; then
    echo "✓ Secret 'OAUTH_REDIRECT_URI' already exists"
else
    echo "Creating placeholder OAuth redirect URI"
    echo -n "https://placeholder.com/api/oauth/callback" | gcloud secrets create "OAUTH_REDIRECT_URI" --data-file=-
    echo "✓ Created (will update after deployment)"
fi

# Note about Supabase URL (not a secret)
echo ""
echo "📍 Supabase Configuration"
echo "✓ SUPABASE_SERVICE_KEY: Using existing 'runaway-supabase-service'"
echo "ℹ️  SUPABASE_URL: Set as environment variable (not secret)"
echo ""

# Grant Secret Manager access to Compute Engine service account
echo "🔑 Granting Secret Manager access to Cloud Run service account"
echo ""

PROJECT_ID=$(gcloud config get-value project)
PROJECT_NUMBER=$(gcloud projects describe "$PROJECT_ID" --format="value(projectNumber)")
SERVICE_ACCOUNT="${PROJECT_NUMBER}-compute@developer.gserviceaccount.com"

echo "Project: $PROJECT_ID"
echo "Service Account: $SERVICE_ACCOUNT"
echo ""

# Grant project-level access (easier than per-secret)
if gcloud projects add-iam-policy-binding "$PROJECT_ID" \
    --member="serviceAccount:$SERVICE_ACCOUNT" \
    --role="roles/secretmanager.secretAccessor" \
    --condition=None &>/dev/null; then
    echo "✓ Granted Secret Manager Secret Accessor role"
else
    echo "⚠️  IAM binding may already exist or failed to add"
fi

echo ""
echo "✅ Secrets setup complete!"
echo ""
echo "Next steps:"
echo "1. Run: gcloud builds submit --config cloudbuild.yaml"
echo "2. After deployment, update OAUTH_REDIRECT_URI with actual service URL"
