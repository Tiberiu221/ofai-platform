# Redis Cache Migration Plan

## Overview
Migrate from in-memory CacheService + rate limiters to Redis-backed storage for persistence across deploys and multi-instance support.

## Current Architecture

### CacheService (`src/services/cache.js`)
In-memory cache with the following API:
- `cache.get(key)` — synchronous lookup
- `cache.set(key, value, ttlMs, groups)` — store with TTL and optional group tags
- `cache.del(key)` — delete specific key
- `cache.cached(key, ttlMs, fetchFn, opts)` — get-or-fetch with request deduplication
- `cache.invalidateGroup(groupName)` — bulk invalidate all keys in a group
- `cache.stats()` — returns `{ hits, misses, ratio%, size }`

Constraints:
- Max 5000 entries, LRU-like eviction (batch of 500 oldest)
- Promise deduplication via `_inflight` Map
- Group invalidation via `_groups` Map of Sets
- All state lost on server restart/deploy

### Cache Groups in Use
| Group | TTL | Keys | Used By |
|-------|-----|------|---------|
| `static` | 2-24h | cities, categories | web.js, businesses.js |
| `homepage` | 30min-2h | dealOfDay, categories, cities, stats | web.js |
| `offers` | 30min | dealOfDay, offer lists | web.js, offers.js |
| `tiers` | 5min | tier:biz:{id} | tiers.js helper |
| `businesses` | varies | business data | web.js |
| `admin` | 1h | dashStats | admin.js |
| `collections` | 2h | collection lists | web.js |
| `blog` | 30min | posts, related | web.js |

### Rate Limiters (`src/middleware/rateLimiter.js`)
10 limiters using `express-rate-limit` with default in-memory store:
- generalLimiter (100/min), writeLimiter (60/min)
- authLimiter (10/15min), passwordResetLimiter (3/hour)
- verifyResetCodeLimiter (5/15min), adminLimiter (60/min)
- createContentLimiter (20/hour), clickLimiter (100/min)
- searchLimiter (30/min), revealLimiter (20/min), mapsParseLimiter (10/min)

All reset on every Railway deploy.

## Migration Plan

### Phase 1: Redis Setup on Railway
1. Add Redis plugin in Railway dashboard (project settings > Plugins > Redis)
2. Railway provides `REDIS_URL` env var automatically
3. Add `ioredis` package: `npm i ioredis`
4. Create `src/services/redis.js`:
   ```js
   const Redis = require('ioredis');
   let client = null;
   function getRedis() {
     if (!client && process.env.REDIS_URL) {
       client = new Redis(process.env.REDIS_URL, {
         maxRetriesPerRequest: 3,
         retryStrategy: (times) => Math.min(times * 100, 3000),
       });
       client.on('error', (err) => console.error('[Redis] Connection error:', err.message));
     }
     return client;
   }
   module.exports = { getRedis };
   ```

### Phase 2: CacheService Migration
Replace Map-based store with Redis commands:

| Current (Map) | Redis Equivalent |
|---------------|-----------------|
| `map.set(key, value)` | `redis.set(key, JSON.stringify(value), 'PX', ttlMs)` |
| `map.get(key)` | `redis.get(key)` then `JSON.parse()` |
| `map.delete(key)` | `redis.del(key)` |
| Group tracking via Sets | Redis Sets: `redis.sadd('group:{name}', key)` |
| Group invalidation | `redis.smembers('group:{name}')` then `redis.del(...keys)` |

Key namespace: `ofai:{group}:{key}` (e.g., `ofai:tiers:biz:123`)

**Note:** `cached()` deduplication must stay in-memory (per-instance) or use Redis SETNX for distributed locking. Recommend keeping it in-memory since it's a performance optimization, not a correctness requirement.

### Phase 3: Rate Limiter Migration
1. Install: `npm i rate-limit-redis`
2. Update `rateLimiter.js`:
   ```js
   const { RedisStore } = require('rate-limit-redis');
   const { getRedis } = require('../services/redis');

   function createStore(prefix) {
     const redis = getRedis();
     if (!redis) return undefined; // falls back to in-memory
     return new RedisStore({ sendCommand: (...args) => redis.call(...args), prefix });
   }
   ```
3. Add `store: createStore('rl:general:')` to each limiter
4. Graceful fallback: if Redis unavailable, express-rate-limit uses default in-memory store

### Phase 4: Monitoring
- Add Redis connection health check to `/health` endpoint
- Log cache hit/miss ratios (already tracked by CacheService)
- Monitor Redis memory usage via Railway dashboard

## Rollback Strategy
1. Set env var `CACHE_BACKEND=memory` to force in-memory mode
2. CacheService factory pattern: check env var, return Redis or Map implementation
3. Rate limiters: `createStore()` already returns `undefined` (in-memory fallback) if Redis unavailable

## Cost Estimate
- Railway Redis: starts at $0/mo (free tier, 256MB)
- Paid: $5/mo for 1GB, sufficient for OFAI's cache needs (~5000 keys = ~5-10MB)
- Rate limiter keys are small (IP + counter), negligible memory

## Dependencies to Add
```json
{
  "ioredis": "^5.4.0",
  "rate-limit-redis": "^4.2.0"
}
```

## Migration Checklist
- [ ] Add Redis plugin on Railway
- [ ] Install ioredis + rate-limit-redis
- [ ] Create src/services/redis.js client
- [ ] Migrate CacheService to Redis backend
- [ ] Migrate rate limiters to RedisStore
- [ ] Test fallback when Redis unavailable
- [ ] Verify cache invalidation works across instances
- [ ] Monitor memory usage for 1 week
- [ ] Remove old in-memory CacheService code
