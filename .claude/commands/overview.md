# Project Overview — OFAI

Genereaza un status rapid al proiectului: git, dependencies, migrations, server health. Util la inceputul unei sesiuni de lucru sau pentru a verifica starea curenta.

## Input: $ARGUMENTS
- **(gol)** — full overview: git + deps + migrations + server
- **`git`** — doar git status (branch, uncommitted, recent commits)
- **`deps`** — doar dependency status (outdated, vulnerabilities)
- **`db`** — doar migration status + DB health
- **`diff`** — overview cu diff detaliat al schimbarilor uncommitted

## Step 1: Git Status

```bash
# Branch curent + remote tracking
git branch -vv --color=never | head -5

# Uncommitted changes (summary)
git status --short

# Ultimele 10 commits
git log --oneline -10 --decorate

# Tags (versions)
git tag --sort=-version:refname | head -5
```

**Atentie la:**
- Fisiere modificate dar necommitted (risc de pierdere)
- Branch main vs feature branch
- Cate commits sunt ahead/behind remote

## Step 2: Dependency Health

### Backend
```bash
cd appredueri_backend
# Outdated packages (summary)
npm outdated 2>/dev/null | head -20
# Vulnerabilities
npm audit --omit=dev 2>&1 | tail -10
# Node version
node -v
```

### Flutter
```bash
cd ofai_flutter
# Flutter version
"C:/dev/flutter/bin/flutter.bat" --version 2>&1 | head -3
# Outdated packages
"C:/dev/flutter/bin/flutter.bat" pub outdated 2>&1 | head -20
```

## Step 3: Migration Status

### Citeste migratii existente
Listeaza toate fisierele din `appredueri_backend/src/migrations/*.sql` — afiseaza ultimele 10 migratii cu numarul si descrierea (din filename).

### Verifica DB production (optional, doar daca user cere)
**ATENTIE:** Nu rula queries pe productie fara confirmare.
```
Connection: postgresql://postgres:REDACTED@REDACTED_DB_HOST/railway
```

Queries de verificare:
```sql
-- Tables count
SELECT COUNT(*) FROM pg_tables WHERE schemaname = 'public';

-- Latest records
SELECT 'users' as t, COUNT(*) FROM users
UNION ALL SELECT 'businesses', COUNT(*) FROM businesses
UNION ALL SELECT 'offers', COUNT(*) FROM offers
UNION ALL SELECT 'reviews', COUNT(*) FROM reviews;
```

## Step 4: Environment & Server

### .env check
```bash
cd appredueri_backend
# Verifica daca .env exista
ls -la .env 2>/dev/null || echo "⚠️ No .env file"
# Verifica variabile critice (fara a expune valori)
grep -c "DATABASE_URL\|JWT_SECRET\|CLOUDINARY" .env 2>/dev/null || echo "Missing critical vars"
```

### Port check
```bash
# Este portul 4000 ocupat?
netstat -ano | grep ":4000" 2>/dev/null || ss -tlnp | grep ":4000" 2>/dev/null || echo "Port 4000 free"
```

## Step 5: Key Files Summary

Afiseaza dimensiunile fisierelor principale (pt a detecta bloat):
```bash
wc -l appredueri_backend/src/routes/web.js appredueri_backend/src/routes/web-portal-api.js appredueri_backend/src/routes/business-portal.js appredueri_backend/src/routes/admin.js 2>/dev/null
wc -l appredueri_backend/src/views/public/portal/manage.ejs 2>/dev/null
```

## Output

```
=== OFAI Project Overview ===
Date: YYYY-MM-DD HH:MM

Git:
  Branch:     main (up to date with origin/main)
  Uncommitted: N files modified, M untracked
  Last commit: <hash> <message> (Xh ago)
  Tags:       v0.9.0 (latest)

Dependencies:
  Backend:    N outdated (X major), Y vulnerabilities
  Flutter:    SDK v3.41, N outdated packages
  Node:       vXX.X.X

Migrations:
  Latest:     054_onboarding_requests.sql
  Total:      N migration files
  DB status:  [requires manual check / OK]

Environment:
  .env:       ✅ exists / ⚠️ missing
  Port 4000:  Free / Occupied by PID XXXX
  key files:  web.js: Xl, manage.ejs: Xl, admin.js: Xl

Quick actions:
  - Run /quality for quality gate
  - Run /deploy-verify for production check
  - Run /review for code review
```
