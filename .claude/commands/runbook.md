# Runbook Generator — OFAI

Genereaza runbook-uri operationale pentru platforma OFAI pe Railway. Analizeaza stack-ul, produce proceduri pas-cu-pas cu comenzi copy-paste, verificari, si rollback.

## Input: $ARGUMENTS
- **(gol)** — genereaza TOATE runbook-urile (deployment, incident, DB maintenance, scaling)
- **`deploy`** — doar deployment runbook
- **`incident`** — doar incident response runbook
- **`db`** — doar database maintenance runbook
- **`scaling`** — doar scaling runbook

## Stack Detection

Confirma stack-ul OFAI citind fisierele:
- `appredueri_backend/package.json` → Express + PostgreSQL
- `appredueri_backend/src/db.js` → Pool config, SSL settings
- `appredueri_backend/src/index.js` → Port, middleware, cron jobs
- `appredueri_backend/src/services/cronJobs.js` → Scheduled tasks
- `.claude/launch.json` → Dev server config
- Nu exista `railway.toml` — Railway auto-detect Node.js

## Runbook 1: Deployment

```markdown
### Pre-deploy Checklist
- [ ] All tests pass locally (`node src/index.js` starts clean)
- [ ] Flutter analyze clean (`flutter analyze --no-pub`)
- [ ] No `.env` secrets in code (`grep -r "STRIPE_SECRET\|JWT_SECRET" src/`)
- [ ] Migrations ready (numbered, IF NOT EXISTS)
- [ ] CLAUDE.md / MEMORY.md updated

### Deploy Steps
1. Push to main: `git push origin main`
2. Railway auto-deploys (~1-2 min)
3. Verify health:
   - `curl -s https://ofai.ro/ | head -5` → should contain "OFAI"
   - `curl -s https://ofai.ro/api/offers?limit=1` → JSON response
   - `curl -s -o /dev/null -w "%{http_code}" https://ofai.ro/css/main.css` → 200

### Post-deploy: Run Pending Migrations
⚠️ Migrațiile NU se aplică automat!

```bash
# Conectare producție
psql "postgresql://postgres:REDACTED@REDACTED_DB_HOST/railway"

# Rulează fiecare migrație secvențial
\i src/migrations/NNN_description.sql
```

### Rollback
1. `git revert HEAD` (creează commit nou care anulează)
2. `git push origin main` (Railway re-deploy)
3. Dacă migrația a fost aplicată și e distructivă:
   - Rulează DOWN migration (din comentariile de la finalul fișierului SQL)
   - Sau restaurează backup Railway (Dashboard → Database → Backups)
```

## Runbook 2: Incident Response

```markdown
### Severity Levels
- **P1 (Critical)**: Site down, DB unreachable, auth broken → respond in 5 min
- **P2 (High)**: Feature broken (offers, portal, payments) → respond in 30 min
- **P3 (Medium)**: Degraded performance, non-critical bugs → respond in 4h
- **P4 (Low)**: UI glitches, logging issues → next business day

### Triage Steps (P1/P2)
1. **Confirm**: `curl -s -o /dev/null -w "%{http_code}" https://ofai.ro/` → 200?
2. **Check Railway**: Dashboard → Deployments → latest deploy status
3. **Check logs**: Railway Dashboard → Logs (sau `railway logs` dacă CLI instalat)
4. **Check DB**: `psql $DATABASE_URL -c "SELECT 1"` → connection OK?
5. **Check Sentry**: https://sentry.io → latest errors

### Common Issues & Fixes

| Symptom | Likely Cause | Fix |
|---------|-------------|-----|
| 503/502 on all routes | Deploy crash | Check Railway logs, revert last deploy |
| DB connection timeout | Pool exhaustion / Railway restart | Restart Railway service, check `db.js` pool settings |
| Auth not working | JWT_SECRET mismatch | Verify env var on Railway matches |
| Stripe webhooks failing | STRIPE_WEBHOOK_SECRET wrong | Check Railway env var, verify endpoint URL |
| CSRF errors on web | Cookie/secret mismatch | Clear cookies, check JWT_SECRET |
| Images not loading | Cloudinary quota/keys | Check CLOUDINARY_* env vars |
| Push notifications failing | FIREBASE_ADMINSDK_JSON | Must be ENTIRE JSON file, not just key |
| Cron jobs not running | cronJobs.js crash at startup | Check logs for cron init errors |

### Escalation
- L1: Check logs + restart service (5 min)
- L2: Revert deploy + restore DB backup (15 min)
- L3: Manual DB intervention + code hotfix (30 min)
```

## Runbook 3: Database Maintenance

```markdown
### Daily (Automatic via Railway)
- Railway handles automatic backups

### Weekly Manual Checks
```bash
# Conectare
psql "postgresql://postgres:REDACTED@REDACTED_DB_HOST/railway"

# Table sizes
SELECT relname, pg_size_pretty(pg_total_relation_size(relid))
FROM pg_catalog.pg_statio_user_tables
ORDER BY pg_total_relation_size(relid) DESC LIMIT 15;

# Index usage (unused indexes waste space)
SELECT schemaname, relname, indexrelname, idx_scan
FROM pg_stat_user_indexes
WHERE idx_scan = 0 AND schemaname = 'public'
ORDER BY pg_relation_size(indexrelid) DESC;

# Dead tuples (need VACUUM?)
SELECT relname, n_dead_tup, n_live_tup,
       round(n_dead_tup::numeric / NULLIF(n_live_tup, 0) * 100, 1) as dead_pct
FROM pg_stat_user_tables
WHERE n_dead_tup > 1000
ORDER BY n_dead_tup DESC;
```

### Monthly
```bash
# Full vacuum analyze (off-peak hours)
VACUUM (VERBOSE, ANALYZE);

# Check for bloated tables
SELECT tablename,
       pg_size_pretty(pg_total_relation_size(quote_ident(tablename))) as total_size
FROM pg_tables WHERE schemaname = 'public'
ORDER BY pg_total_relation_size(quote_ident(tablename)) DESC;

# Verify subscription integrity
SELECT COUNT(*) as orphaned_subs FROM business_subscriptions bs
WHERE NOT EXISTS (SELECT 1 FROM businesses b WHERE b.id = bs.business_id);

# Badge sync check
SELECT COUNT(*) as badge_mismatch FROM businesses b
JOIN business_subscriptions bs ON bs.business_id = b.id
JOIN subscription_plans sp ON sp.id = bs.plan_id
WHERE bs.status IN ('active','trial')
AND COALESCE(b.subscription_badge_type,'') != COALESCE(sp.badge_type,'');
```

### Emergency: Restore from Backup
1. Railway Dashboard → Database → Backups
2. Select latest backup before incident
3. Restore to new database
4. Update DATABASE_URL env var to point to restored DB
5. Verify data integrity
6. Switch traffic
```

## Runbook 4: Scaling

```markdown
### Current Limits (Railway Hobby)
- 8 GB RAM, 8 vCPUs
- PostgreSQL: shared resources
- No horizontal scaling (single instance)

### When to Scale
- Response times > 500ms consistently
- Memory usage > 70% of limit
- DB connections > 80% of pool (currently max 10 in db.js)

### Scaling Options
1. **Vertical**: Upgrade Railway plan (Pro = dedicated resources)
2. **DB Pool**: Increase pool.max in db.js (current: 10)
3. **Caching**: Add Redis for frequently accessed data (subscription plans, categories)
4. **CDN**: Cloudflare already handles static assets; add page rules for /oferte caching
5. **Read Replicas**: Railway supports PostgreSQL replicas for read-heavy workloads

### Connection Pool Tuning
```js
// src/db.js — current settings
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 10,          // Increase to 20 for higher traffic
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
});
```
```

## Output Format

Salveaza runbook-urile generate in `docs/runbooks/`:
- `docs/runbooks/deployment.md`
- `docs/runbooks/incident-response.md`
- `docs/runbooks/database-maintenance.md`
- `docs/runbooks/scaling.md`

Afiseaza rezumat cu ce a fost generat si unde a fost salvat.
