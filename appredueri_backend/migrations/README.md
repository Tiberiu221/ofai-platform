# Database Migrations

This folder contains SQL migration files for the OFAI database.

## How to Apply Migrations

### Local Development

1. Make sure your `.env` file has the correct `DATABASE_URL`
2. Connect to your PostgreSQL database
3. Run the migration file:

```bash
# Using psql (recommended)
psql $DATABASE_URL -f migrations/create_review_summaries.sql

# Or using Node.js
node -e "const pool = require('./src/db'); const fs = require('fs'); const sql = fs.readFileSync('./migrations/create_review_summaries.sql', 'utf8'); pool.query(sql).then(() => { console.log('Migration applied!'); process.exit(0); }).catch(err => { console.error(err); process.exit(1); });"
```

### Production (Railway)

**Option 1: Railway CLI**
```bash
railway run psql -f migrations/create_review_summaries.sql
```

**Option 2: Railway Dashboard**
1. Go to your Railway project
2. Click on your PostgreSQL service
3. Go to "Query" tab
4. Copy and paste the contents of `create_review_summaries.sql`
5. Execute

**Option 3: Programmatically (safest)**
```bash
# Connect to production database
railway connect PostgreSQL

# Then run:
\i migrations/create_review_summaries.sql
```

## Migration Files

| File | Description | Date |
|------|-------------|------|
| `add_booking_fields.sql` | Adds booking-related fields | - |
| `add_booking_to_businesses.sql` | Adds booking support to businesses | - |
| `add_booking_to_offers.sql` | Adds booking support to offers | - |
| `create_review_summaries.sql` | Creates table for AI review summaries | 2026-02-03 |

## Verification

After applying `create_review_summaries.sql`, verify with:

```sql
-- Check if table exists
SELECT table_name 
FROM information_schema.tables 
WHERE table_name = 'review_summaries';

-- Check table structure
\d review_summaries

-- Check indexes
SELECT indexname, indexdef 
FROM pg_indexes 
WHERE tablename = 'review_summaries';
```

Expected output:
- Table: `review_summaries` with 8 columns
- Indexes: `idx_review_summaries_business_id`, `idx_review_summaries_generated_at`
- Foreign keys: `business_id` → `businesses(id)`, `last_review_id` → `reviews(id)`

## Rollback

To undo the `review_summaries` migration:

```sql
DROP TABLE IF EXISTS review_summaries CASCADE;
```

⚠️ **Warning**: This will permanently delete all generated summaries!
