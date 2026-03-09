# Observability Designer — OFAI

Designeaza strategia de monitoring si observability pentru platforma OFAI in productie. Defineste SLIs/SLOs, alerting, dashboards, si logging strategy.

## Input: $ARGUMENTS
- **(gol)** — full observability design: SLI/SLO + metrics + logging + alerting
- **`slo`** — doar SLI/SLO definitions
- **`alerts`** — doar alerting rules
- **`dashboard`** — doar dashboard design
- **`logging`** — doar structured logging strategy

## Current Stack

- **Backend:** Node.js/Express on Railway (single instance)
- **Database:** PostgreSQL on Railway
- **Error tracking:** Sentry (already integrated)
- **CDN:** Cloudflare (proxy ON)
- **No current metrics/dashboards** — need to design from scratch

## Step 1: SLI/SLO Definitions

### Availability SLO
- **SLI:** Percentage of HTTP requests that return non-5xx status
- **Target:** 99.5% (allows ~3.6h downtime/month)
- **Measurement:** Cloudflare analytics + Sentry error rates

### Latency SLO
- **SLI:** Percentage of requests completing within threshold
- **Targets:**
  - P50 < 200ms (page renders)
  - P95 < 500ms (API responses)
  - P99 < 2000ms (complex queries like analytics)
- **Measurement:** Express response time middleware

### Error Rate SLO
- **SLI:** Percentage of requests without errors
- **Target:** < 1% error rate
- **Measurement:** Sentry + Express error middleware

## Step 2: Golden Signals (per endpoint)

### Latency
```js
// Middleware to track response time (add to index.js)
app.use((req, res, next) => {
  const start = process.hrtime.bigint();
  res.on('finish', () => {
    const duration = Number(process.hrtime.bigint() - start) / 1e6; // ms
    const route = req.route?.path || req.path;
    const method = req.method;
    const status = res.statusCode;
    // Log or send to metrics collector
    if (duration > 1000) {
      console.warn(`SLOW_REQUEST: ${method} ${route} ${status} ${duration.toFixed(0)}ms`);
    }
  });
  next();
});
```

### Traffic
```sql
-- Requests per hour (from business_views + offer_views as proxy)
SELECT DATE_TRUNC('hour', viewed_at) as hour, COUNT(*) as views
FROM business_views
WHERE viewed_at >= NOW() - INTERVAL '24 hours'
GROUP BY hour ORDER BY hour;
```

### Errors
- Sentry dashboard: group by route, frequency, impact
- Express uncaughtException + unhandledRejection logging

### Saturation
```js
// Connection pool monitoring
const pool = require('./db');
setInterval(() => {
  console.log(`DB_POOL: total=${pool.totalCount} idle=${pool.idleCount} waiting=${pool.waitingCount}`);
}, 60000);

// Memory monitoring
setInterval(() => {
  const m = process.memoryUsage();
  console.log(`MEMORY: rss=${(m.rss/1024/1024).toFixed(0)}MB heap=${(m.heapUsed/1024/1024).toFixed(0)}/${(m.heapTotal/1024/1024).toFixed(0)}MB`);
}, 60000);
```

## Step 3: Structured Logging

### Log Format
```js
// Structured JSON logging for Railway
const log = (level, message, meta = {}) => {
  console.log(JSON.stringify({
    timestamp: new Date().toISOString(),
    level,      // info, warn, error, debug
    message,
    ...meta,
    service: 'ofai-backend',
    env: process.env.NODE_ENV || 'development'
  }));
};

// Usage:
log('info', 'Offer created', { offerId: 123, businessId: 456, tier: 'standard' });
log('error', 'DB query failed', { query: 'offers_feed', duration: 5200, error: err.message });
log('warn', 'Rate limit hit', { ip: req.ip, route: '/api/offers' });
```

### Log Levels
| Level | When | Example |
|-------|------|---------|
| `error` | Unrecoverable failures | DB connection lost, Stripe webhook failed |
| `warn` | Degraded but functional | Slow query >1s, rate limit hit, Sentry report |
| `info` | Key business events | Offer created, subscription changed, user registered |
| `debug` | Dev-only diagnostics | Query results, cache hits/misses |

### Critical Business Events to Log
- [ ] User registration (web + mobile + Google OAuth)
- [ ] Business subscription changes (upgrade, downgrade, cancel, expire)
- [ ] Offer CRUD operations
- [ ] Payment events (Stripe webhook received, processed, failed)
- [ ] Cron job execution (start, end, items processed)
- [ ] Auth failures (wrong password, expired token, banned user)
- [ ] Rate limit triggers

## Step 4: Alerting Rules

### Critical (P1) — Immediate notification
| Alert | Condition | Action |
|-------|-----------|--------|
| Site Down | 3+ consecutive 5xx on `/` | Check Railway, restart |
| DB Unreachable | Pool error event | Check Railway DB, connections |
| Memory > 80% | RSS > 6.4GB (of 8GB) | Investigate leak, restart |
| Error spike | >10 errors/min in Sentry | Check latest deploy |

### Warning (P2) — Check within 30 min
| Alert | Condition | Action |
|-------|-----------|--------|
| Slow queries | P95 > 2s for 5 min | Check EXPLAIN ANALYZE |
| Pool saturated | waiting > 5 for 1 min | Increase pool.max |
| Cron failed | Cron job throws error | Check logs, re-run manually |
| Stripe webhook 4xx | >3 failed webhooks/hour | Check secret, endpoint |

### Info (P3) — Daily review
| Alert | Condition | Action |
|-------|-----------|--------|
| High traffic | >2x normal RPS | Monitor, plan scaling |
| New Sentry issue | First occurrence | Triage and prioritize |
| Disk usage > 70% | Railway DB storage | Plan cleanup |

## Step 5: Dashboard Design

### Dashboard 1: Overview (primary)
```
┌─────────────────────────────┬─────────────────────────────┐
│ Uptime (30d)                │ Error Rate (24h)            │
│ 99.7% ████████████████░     │ 0.3% ██░░░░░░░░░░░░░░      │
├─────────────────────────────┼─────────────────────────────┤
│ Request Latency (P50/P95)   │ Active Users (24h)          │
│ P50: 120ms  P95: 380ms     │ 234 users                   │
├─────────────────────────────┼─────────────────────────────┤
│ DB Pool (total/idle/waiting) │ Memory (RSS / Heap)         │
│ 10 / 7 / 0                 │ 280MB / 150MB               │
├─────────────────────────────┼─────────────────────────────┤
│ Top Errors (Sentry, 24h)    │ Cron Jobs Status            │
│ 1. TypeError: null ref (5x) │ ✅ deal-of-day (00:05)     │
│ 2. CSRF mismatch (3x)      │ ✅ cleanup-expired (01:00)  │
└─────────────────────────────┴─────────────────────────────┘
```

### Dashboard 2: Business Metrics
```
┌─────────────────────────────┬─────────────────────────────┐
│ Offers Created (7d)         │ Subscriptions by Tier       │
│ ████████ 23                 │ Free: 45  Std: 12  Prm: 3  │
├─────────────────────────────┼─────────────────────────────┤
│ New Users (7d)              │ New Businesses (7d)         │
│ ████████████ 67             │ ████ 8                      │
├─────────────────────────────┼─────────────────────────────┤
│ Top Cities (views)          │ Top Categories (views)      │
│ 1. Cluj 42%  2. Buc 28%    │ 1. Restaurante  2. Beauty   │
└─────────────────────────────┴─────────────────────────────┘
```

## Implementation Priority

1. **Week 1:** Structured logging + response time middleware
2. **Week 2:** Sentry alert rules + DB pool monitoring
3. **Week 3:** Health check endpoint (`/health`) for uptime monitoring
4. **Month 2:** Business metrics dashboard queries
5. **Month 3:** Full dashboard (Grafana Cloud free tier or Railway metrics)

## Output

Genereaza plan de implementare cu:
1. Fisierele de modificat si codul necesar
2. Ordinea de implementare (quick wins first)
3. Tooling recomandat (Sentry, Grafana Cloud, Uptime Robot, Better Stack)
4. Cost estimat (prefer free tier tools)
