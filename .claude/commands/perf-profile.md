# Performance Profiler — OFAI

Profile si optimizeaza performanta backend-ului Node.js/Express + PostgreSQL. Masoara inainte si dupa orice optimizare.

## Input: $ARGUMENTS
- **(gol)** — full profile: CPU + memory + DB + bundle
- **`db`** — doar query profiling (EXPLAIN ANALYZE pe slow queries)
- **`api`** — doar API latency testing (autocannon)
- **`memory`** — doar memory profiling (heap snapshots)
- **`bundle`** — doar analiza node_modules size

## Golden Rule: Measure First

Inainte de ORICE optimizare:
1. Stabileste baseline (latency P50/P95/P99, RPS, memory usage)
2. Identifica bottleneck-ul real cu profiling
3. Fix
4. Masoara din nou — confirma improvement

## Step 1: Node.js CPU Profiling

```bash
# Clinic.js flamegraph (best)
cd appredueri_backend && npx clinic flame -- node src/index.js
# In alt terminal, genereaza load:
npx autocannon -c 50 -d 30 http://localhost:4000/oferte

# Alternativ: Node built-in profiler
cd appredueri_backend && node --prof src/index.js
node --prof-process isolate-*.log | head -100

# V8 inspector (Chrome DevTools)
cd appredueri_backend && node --inspect src/index.js
# Deschide chrome://inspect -> Performance -> Record
```

## Step 2: Memory Profiling

```bash
# Heap snapshot cu clinic.js
cd appredueri_backend && npx clinic heapprofiler -- node src/index.js

# Event loop blocking
cd appredueri_backend && npx clinic bubbleprof -- node src/index.js

# Manual: process.memoryUsage() tracking
node -e "
const http = require('http');
setInterval(() => {
  const m = process.memoryUsage();
  console.log('RSS:', (m.rss/1024/1024).toFixed(1), 'MB',
              'Heap:', (m.heapUsed/1024/1024).toFixed(1), '/',
              (m.heapTotal/1024/1024).toFixed(1), 'MB');
}, 5000);
require('./src/index.js');
"
```

## Step 3: PostgreSQL Query Profiling

Queries care trebuie verificate (din routes-urile noastre):

```sql
-- Top slow queries (pe production DB)
-- Railway nu are pg_stat_statements, asa ca profiling manual:

-- Oferte feed (web.js /oferte) — cel mai frecvent
EXPLAIN ANALYZE
SELECT o.*, b.name as business_name, b.slug as business_slug, b.logo_url,
       b.subscription_badge_type, c.name as category_name
FROM offers o
JOIN businesses b ON b.id = o.business_id
LEFT JOIN categories c ON c.id = b.category_id
WHERE o.is_active = true AND (o.end_date IS NULL OR o.end_date >= CURRENT_DATE)
ORDER BY o.id DESC LIMIT 20;

-- Business detail (web.js /business/:slug) — JOIN-uri multiple
EXPLAIN ANALYZE
SELECT b.*, c.name as category_name, ci.name as city_name,
       (SELECT COUNT(*) FROM followed_businesses WHERE business_id = b.id) as follower_count,
       (SELECT AVG(rating) FROM reviews WHERE business_id = b.id) as avg_rating
FROM businesses b
LEFT JOIN categories c ON c.id = b.category_id
LEFT JOIN cities ci ON ci.id = b.city_id
WHERE b.slug = 'test-business';

-- Analytics queries (manage.ejs portal)
EXPLAIN ANALYZE
SELECT DATE(viewed_at) as date, COUNT(*) as views
FROM business_views WHERE business_id = 1 AND viewed_at >= NOW() - INTERVAL '30 days'
GROUP BY DATE(viewed_at) ORDER BY date ASC;

EXPLAIN ANALYZE
SELECT DATE(created_at) as date, COUNT(*) as clicks
FROM business_clicks WHERE business_id = 1 AND created_at >= NOW() - INTERVAL '30 days'
GROUP BY DATE(created_at) ORDER BY date ASC;

-- Favorites/follows (colectia-mea)
EXPLAIN ANALYZE
SELECT o.*, b.name as business_name FROM favorites f
JOIN offers o ON o.id = f.offer_id
JOIN businesses b ON b.id = o.business_id
WHERE f.user_id = 1 ORDER BY f.id DESC LIMIT 10000;
```

### Index Verification

```sql
-- Verifică indexuri existente
SELECT tablename, indexname, indexdef
FROM pg_indexes WHERE schemaname = 'public'
ORDER BY tablename, indexname;

-- Verifică missing indexes pe foreign keys
SELECT c.conrelid::regclass AS table_name,
       a.attname AS column_name,
       c.conname AS constraint_name
FROM pg_constraint c
JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = ANY(c.conkey)
WHERE c.contype = 'f'
AND NOT EXISTS (
  SELECT 1 FROM pg_index i
  WHERE i.indrelid = c.conrelid
  AND a.attnum = ANY(i.indkey)
);
```

## Step 4: API Load Testing

```bash
# autocannon — simplu si rapid
cd appredueri_backend && npx autocannon -c 20 -d 10 http://localhost:4000/oferte
cd appredueri_backend && npx autocannon -c 20 -d 10 http://localhost:4000/api/offers?limit=20

# Test specific endpoints
npx autocannon -c 10 -d 10 -m GET http://localhost:4000/api/businesses?limit=20
npx autocannon -c 10 -d 10 -m GET http://localhost:4000/api/offers/1

# Cu autentificare (Bearer token)
npx autocannon -c 10 -d 10 -H "Authorization=Bearer <token>" http://localhost:4000/api/users/me
```

## Step 5: Bundle / Dependencies Size

```bash
cd appredueri_backend
# node_modules size
du -sh node_modules/
# Top 10 biggest dependencies
du -sh node_modules/* | sort -rh | head -20

# Unused dependencies
npx depcheck

# Flutter package size
cd ofai_flutter
"C:/dev/flutter/bin/flutter.bat" build apk --analyze-size
```

## Output

Genereaza raport structurat:

```
=== Performance Profile — OFAI ===
Date: YYYY-MM-DD

## CPU
- Flamegraph: [link/screenshot]
- Hot functions: ...
- Recommendation: ...

## Memory
- RSS baseline: X MB
- Heap usage: X / Y MB
- Leak detected: YES/NO
- Recommendation: ...

## Database
- Slowest query: X ms (endpoint Y)
- Missing indexes: [list]
- N+1 detected: [list]
- Recommendation: ...

## API Latency
| Endpoint | P50 | P95 | P99 | RPS |
|----------|-----|-----|-----|-----|
| GET /oferte | X ms | Y ms | Z ms | N |
| GET /api/offers | X ms | Y ms | Z ms | N |

## Bundle
- node_modules: X MB
- Unused deps: [list]
- Flutter APK: X MB

## Priority Actions
1. ...
2. ...
3. ...
```
