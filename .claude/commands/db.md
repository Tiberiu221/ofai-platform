# Database Operations — OFAI

Operatii rapide pe baza de date PostgreSQL: verificare schema, migration status, run queries, inspect tables.

## Input: $ARGUMENTS
- **(gol)** — afiseaza schema overview (tables, counts, migration status)
- **`schema`** — afiseaza structura completa a tabelelor
- **`schema <table>`** — afiseaza structura unei tabele specifice
- **`count`** — row counts pt toate tabelele
- **`migrate`** — listeaza migratii si status-ul lor
- **`migrate run <NNN>`** — ruleaza o migratie specifica (CU CONFIRMARE!)
- **`query <SQL>`** — ruleaza un SELECT query (doar SELECT — nu INSERT/UPDATE/DELETE)
- **`indexes`** — listeaza indexuri si usage stats
- **`health`** — DB health check (connections, size, dead tuples)
- **`seed`** — ruleaza seed scripts (cu confirmare)

## Conexiune

### Production
```
postgresql://postgres:REDACTED@REDACTED_DB_HOST/railway
```
SSL: `{ rejectUnauthorized: false }`

### Local (dev)
Foloseste `DATABASE_URL` din `.env` sau default `postgresql://localhost:5432/ofai`

### Pattern de conectare
```bash
cd appredueri_backend
node -e "
const {Pool} = require('pg');
const pool = new Pool({
  connectionString: '<CONNECTION_STRING>',
  ssl: { rejectUnauthorized: false }
});
pool.query('<QUERY>').then(r => {
  console.log(JSON.stringify(r.rows, null, 2));
}).catch(e => console.error(e.message)).finally(() => pool.end());
"
```

## Operatie: Schema Overview

```sql
-- Table list cu row counts
SELECT t.tablename,
  pg_size_pretty(pg_total_relation_size(quote_ident(t.tablename))) as size,
  s.n_live_tup as rows
FROM pg_tables t
LEFT JOIN pg_stat_user_tables s ON s.relname = t.tablename
WHERE t.schemaname = 'public'
ORDER BY pg_total_relation_size(quote_ident(t.tablename)) DESC;
```

## Operatie: Schema <table>

```sql
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_name = '<TABLE>' AND table_schema = 'public'
ORDER BY ordinal_position;

-- Plus indexuri pe acea tabela
SELECT indexname, indexdef
FROM pg_indexes
WHERE tablename = '<TABLE>' AND schemaname = 'public';

-- Plus FK constraints
SELECT tc.constraint_name, kcu.column_name,
       ccu.table_name AS foreign_table, ccu.column_name AS foreign_column
FROM information_schema.table_constraints tc
JOIN information_schema.key_column_usage kcu ON tc.constraint_name = kcu.constraint_name
JOIN information_schema.constraint_column_usage ccu ON tc.constraint_name = ccu.constraint_name
WHERE tc.table_name = '<TABLE>' AND tc.constraint_type = 'FOREIGN KEY';
```

## Operatie: Migration Status

### Listeaza migratii locale
```bash
ls -la appredueri_backend/src/migrations/*.sql | sort
```

### Verifica ce exista in DB
Compara tabelele/coloanele din migratii cu ce exista in production.

### Key migrations OFAI
| # | Fisier | Descriere | Tabele/Coloane |
|---|--------|-----------|----------------|
| 041 | missing_tables | user_points, favorite_offers, followed_businesses, offer_locations | CREATE TABLE IF NOT EXISTS |
| 042 | update_tier_values | Tier values update | UPDATE subscription_plans |
| 043 | badge_definitions | Badge system | badge_definitions, user_badges |
| 044 | business_locations_maps_url | Maps URL | ALTER business_locations ADD maps_url |
| 045 | premium_gallery_64 | Gallery limit 32→64 | UPDATE subscription_plans |
| 046 | schema_from_legacy | Legacy schema gaps | Multiple ALTERs |
| 047 | missing_indexes | Performance indexes | CREATE INDEX |
| 048 | reports | Report system | CREATE TABLE reports |
| 049 | offer_moderation | AI moderation | ALTER offers ADD ai_score, moderation_status |
| 050 | offer_rejection_reason | Rejection flow | ALTER offers ADD rejection_reason |
| 051 | free_plan_booking | Free plan booking | UPDATE subscription_plans |
| 052 | business_hours | Opening hours | CREATE TABLE business_hours |
| 053 | business_catalog | Unified catalog | CREATE TABLE business_catalog_* |
| 054 | onboarding_requests | Concierge onboarding | CREATE TABLE onboarding_requests |

## Operatie: Run Migration

**CRITICAL:** Intotdeauna confirma cu utilizatorul inainte de a rula!

1. Citeste fisierul SQL
2. Afiseaza continutul
3. INTREABA: "Rulezi aceasta migratie pe [production/local]?"
4. Dupa rulare, verifica cu `SELECT` ca obiectele exista

## Operatie: Indexes

```sql
-- Index usage stats
SELECT schemaname, relname, indexrelname,
       idx_scan, idx_tup_read, idx_tup_fetch,
       pg_size_pretty(pg_relation_size(indexrelid)) as size
FROM pg_stat_user_indexes
WHERE schemaname = 'public'
ORDER BY idx_scan ASC
LIMIT 30;

-- Missing FK indexes
SELECT c.conrelid::regclass AS table_name,
       a.attname AS column_name
FROM pg_constraint c
JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = ANY(c.conkey)
WHERE c.contype = 'f'
AND NOT EXISTS (
  SELECT 1 FROM pg_index i
  WHERE i.indrelid = c.conrelid AND a.attnum = ANY(i.indkey)
);
```

## Operatie: Health

```sql
-- Connection info
SELECT count(*) as active_connections FROM pg_stat_activity;

-- Database size
SELECT pg_size_pretty(pg_database_size(current_database())) as db_size;

-- Dead tuples (need VACUUM?)
SELECT relname, n_dead_tup, n_live_tup,
       round(n_dead_tup::numeric / NULLIF(n_live_tup, 0) * 100, 1) as dead_pct,
       last_vacuum, last_autovacuum
FROM pg_stat_user_tables
WHERE n_dead_tup > 100
ORDER BY n_dead_tup DESC
LIMIT 10;

-- Long-running queries
SELECT pid, state, query_start, LEFT(query, 80) as query
FROM pg_stat_activity
WHERE state != 'idle' AND query_start < NOW() - INTERVAL '30 seconds';
```

## Operatie: Seed

```bash
cd appredueri_backend

# Seed businesses (test data)
node scripts/seed-businesses.js

# Seed stats (analytics test data)
node scripts/seed-stats.js

# Fix images (Cloudinary cleanup)
node scripts/fix-images.js
```

**INTOTDEAUNA intreaba** care script sa ruleze si pe ce environment (local/production).

## Safety Rules

1. **NICIODATA** INSERT/UPDATE/DELETE fara confirmare explicita
2. **NICIODATA** DROP TABLE/INDEX fara confirmare
3. **INTOTDEAUNA** foloseste SSL pe production
4. **INTOTDEAUNA** afiseaza SQL-ul inainte de executie
5. Queries de tip `query` accepta DOAR SELECT statements
6. Migratii pe production → intotdeauna backup mental (Railway are automatic backups)
