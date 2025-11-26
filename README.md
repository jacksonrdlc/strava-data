# Strava Data ETL Pipeline

A Node.js ETL (Extract, Transform, Load) utility for importing Strava activity data from CSV exports into a Supabase PostgreSQL database.

## Project Structure

```
├── config/
│   └── .env                     # Environment configuration
├── data/                        # Strava export data
│   ├── activities.csv          # Main activities data
│   └── ...                     # Other CSV files from Strava export
├── docs/
│   ├── strava_erd.md           # Database schema documentation
│   └── example.json            # Example data structure
├── scripts/
│   ├── database/
│   │   ├── schema/             # Database schema files
│   │   │   ├── create_supabase_database.sql
│   │   │   ├── create_*indexes*.sql
│   │   │   └── insert_reference_data*.sql
│   │   └── utilities/          # Database utility scripts
│   │       ├── disable_*.sql
│   │       ├── enable_*.sql
│   │       └── cleanup-*.sql
│   └── import/                 # Import scripts
│       ├── strava-csv-import.js        # Main import script
│       ├── strava-csv-import-updated.js
│       ├── import-all-data.js
│       └── import-simple-no-fk.js
├── CLAUDE.md                   # Claude Code instructions
└── package.json               # Project configuration
```

## Quick Start

1. **Setup Environment**
   ```bash
   cp config/.env.example config/.env
   # Edit config/.env with your Supabase credentials
   ```

2. **Install Dependencies**
   ```bash
   npm install
   ```

3. **Setup Database**
   ```bash
   # Run in Supabase SQL editor:
   psql -f scripts/database/schema/create_supabase_database.sql
   ```

4. **Prepare Data**
   - Download your Strava data export
   - Extract `activities.csv` to `data/activities.csv`

5. **Run Import**
   ```bash
   npm run import
   ```

## Available Scripts

- `npm run import` - Main import script
- `npm run import-all` - Import all data types
- `npm run import-simple` - Simple import without foreign keys
- `npm run lint` - Code quality check

## Configuration

Create `config/.env` with:
```env
SUPABASE_URL=your_supabase_url
SUPABASE_SERVICE_KEY=your_service_key
STRAVA_CLIENT_ID=your_strava_client_id
```

## Database Schema

The project creates normalized tables for:
- **athletes** - User profiles
- **activities** - Core activity data with metrics
- **gear** - Equipment (bikes, shoes, etc.)
- **segments** - Route segments
- **routes** - Saved routes

See `docs/strava_erd.md` for detailed schema documentation.

## Features

- ✅ Batch processing for large datasets
- ✅ Data validation and error handling
- ✅ Upsert operations for safe re-runs
- ✅ Progress tracking and reporting
- ✅ Foreign key constraint handling
- ✅ Comprehensive database schema

## Troubleshooting

**Foreign Key Errors**: Ensure athlete record exists before importing activities
**Missing Data**: Check CSV file paths and environment variables
**Rate Limits**: Adjust BATCH_SIZE in import scripts

## Contributing

See `CLAUDE.md` for development guidelines and project context.