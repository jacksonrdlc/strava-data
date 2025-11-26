# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a Strava CSV to Supabase data import utility - a Node.js ETL script that processes Strava activity export data and imports it into a Supabase database. The project transforms CSV data from Strava's export format into a normalized database structure.

## Commands

### Running the Import
```bash
npm run import       # Executes the main data import script
npm run import-all   # Import all data types
npm run import-simple # Simple import without foreign keys
```

### Development
```bash
npm run lint    # Run ESLint for code quality checks
npm test        # No tests configured (placeholder)
```

## Architecture

### Organized ETL Pipeline
The data processing pipeline is organized in `scripts/import/`:

1. **CSV Parsing** → **Data Transformation** → **Database Insertion**
2. **Input**: `data/activities.csv` (Strava export file)
3. **Output**: Normalized records in Supabase tables

### Core Functions
- `csvRowToActivity()`: Transforms CSV rows to database records with data type conversions, date parsing, and unit conversions (distance to meters)
- Batch processing with 50-record batches to avoid rate limits
- Upsert operations for idempotent imports

### Database Schema
Database schema files in `scripts/database/schema/`:
- `activities`: Core activity records with metrics, timing, location
- `athletes`: Athlete/user profile records
- `gear`: Equipment records (bikes, shoes, etc.)

### Configuration
Environment variables in `config/.env`:
- `SUPABASE_URL`: Database connection URL
- `SUPABASE_SERVICE_KEY`: Authentication key
- `STRAVA_CLIENT_ID`: Strava API identifier

Hardcoded constants:
- `DEFAULT_ATHLETE_ID = 1`
- `BATCH_SIZE = 50`
- `CSV_FILE_PATH = './data/activities.csv'`

## Data Processing Notes

- Handles data validation and filters invalid records
- Graceful error handling with detailed reporting
- Progress tracking with import statistics
- Uses upsert operations for safe re-runs
- Converts Strava CSV fields to match database schema requirements

## Development Context

This is a focused utility project for personal data migration rather than a multi-feature application. The codebase is designed for single-athlete data processing and periodic imports from Strava exports.