---
description: Analyze code for performance issues — slow queries, N+1 problems, missing indexes, memory leaks, bundle size. OFAI-specific.
---

# Performance Optimizer — OFAI

Analyze the codebase for performance issues. Focus on OFAI-specific patterns.

## Analysis Steps

### 1. Database Performance
```bash
# Find queries without indexes
grep -rn "WHERE" appredueri_backend/src/routes/ --include="*.js" | grep -v "node_modules"

# Find N+1 patterns (queries inside loops)
grep -rn "for.*await.*pool.query\|forEach.*pool.query\|map.*pool.query" appredueri_backend/src/routes/ --include="*.js"

# Find missing LIMIT on SELECT *
grep -rn "SELECT \*" appredueri_backend/src/routes/ --include="*.js" | grep -v "LIMIT\|COUNT\|WHERE.*id"

# Check for sequential queries that should be Promise.all()
grep -rn "await pool.query" appredueri_backend/src/routes/ --include="*.js" -A1 | grep -A1 "await pool.query"
```

### 2. API Response Size
- Check for over-fetching (`SELECT *` when only 3 columns needed)
- Check for missing pagination on list endpoints
- Check for large JSON payloads (embedded arrays, nested objects)

### 3. Caching Opportunities
- Identify hot queries (called on every page load)
- Check existing cache usage (`require('../services/cache')`)
- Suggest cache keys and TTLs for uncached heavy queries

### 4. Frontend Performance (Flutter)
```bash
# Find missing memCacheWidth/Height on images
grep -rn "CachedNetworkImage" ofai_flutter/lib/ --include="*.dart" | grep -v "memCache"

# Find excessive rebuilds (providers without .select())
grep -rn "ref.watch(" ofai_flutter/lib/screens/ --include="*.dart"

# Find synchronous operations in build methods
grep -rn "await.*build\|Future.*build" ofai_flutter/lib/ --include="*.dart"
```

### 5. Web Performance
- Check CSS/JS bundle size
- Check image optimization (Cloudinary transforms)
- Check for render-blocking resources in `<head>`
- Verify `loading="lazy"` on below-fold images

## Report Format

For each issue found:
```
### [SEVERITY] Issue Title
- **File:** path:line
- **Type:** N+1 | Missing Index | Over-fetch | Cache Miss | Memory Leak
- **Current:** What's happening now (with numbers if possible)
- **Impact:** Estimated performance impact
- **Fix:** Specific remediation
- **Priority:** P0 (fix now) | P1 (next sprint) | P2 (backlog)
```

## OFAI-Specific Checks
- Deal of Day query uses `hashtext()` — verify index on scoring columns
- Popular offers has `RANDOM()` — cannot be cached (by design)
- Category feed cron runs daily — check if batch size is reasonable
- Admin analytics: 40+ queries in Promise.all() with 15-min cache — verify cache works
- Blog: in-memory cache 15min list, 30min post — verify invalidation
