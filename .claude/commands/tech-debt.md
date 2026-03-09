# Tech Debt Tracker — OFAI

Identifica, categorizeaza si prioritizeaza tech debt-ul din codebase. Scaneaza fisiere mari, cod duplicat, TODO-uri, functii lungi, si probleme de arhitectura.

## Input: $ARGUMENTS
- **(gol)** — full scan: code + architecture + test + documentation debt
- **`code`** — doar code-level debt (long functions, complexity, duplicates)
- **`arch`** — doar architecture debt (coupling, separation of concerns)
- **`todo`** — doar TODO/FIXME/HACK scan

## Known Debt Hotspots (OFAI-specific)

Aceste fisiere au cel mai mare debt acumulat:
- `src/routes/web.js` — **~2900+ linii**, God file, amestec de web pages + AJAX + portal
- `src/views/public/portal/manage.ejs` — **~2000+ linii**, God template
- `src/public/css/main.css` — **~4000+ linii**, monolith CSS
- `src/public/js/main.js` — client-side JS fara module system

## Scan 1: Code Debt

### Long Functions (>50 lines)
```bash
# Scanează funcții/rute lungi in JS
# Route handlers in web.js, business-portal.js
grep -n "router\.\(get\|post\|put\|delete\)(" src/routes/web.js | head -50
grep -n "router\.\(get\|post\|put\|delete\)(" src/routes/business-portal.js | head -30

# Count lines per route handler (rough approximation)
# Funcțiile > 50 linii trebuie refactorizate
```

### TODOs, FIXMEs, HACKs
```bash
# Backend
grep -rn "TODO\|FIXME\|HACK\|XXX\|TEMP\|WORKAROUND" appredueri_backend/src/ --include="*.js" --include="*.ejs"

# Flutter
grep -rn "TODO\|FIXME\|HACK\|XXX" ofai_flutter/lib/ --include="*.dart"
```

### Dead Code
```bash
# Unused exports in backend
npx unimported --no-cache 2>/dev/null || echo "Manual check needed"

# Unused routes — grep for defined routes not referenced elsewhere
grep -h "router\.\(get\|post\|put\|delete\)(" src/routes/*.js | sed "s/.*('\(.*\)'.*/\1/" | sort -u

# Commented-out code blocks (>3 lines)
grep -n "^[[:space:]]*//" src/routes/web.js | head -30
```

### Duplicate Logic
Known duplications in OFAI:
- [ ] Offer creation: `web.js` AND `business-portal.js` (both call `offerService.createOffer()` — OK)
- [ ] Subscription cancel: consolidated into `subscriptionService.js` — OK
- [ ] Auth checks: 3 separate middleware files (webAuth, businessWebAuth, auth) — by design
- [ ] Favorites/follows queries: duplicated in web.js and mobile routes — check for divergence

## Scan 2: Architecture Debt

### File Size Analysis
```bash
# Biggest files by line count
wc -l appredueri_backend/src/routes/*.js | sort -rn | head -10
wc -l appredueri_backend/src/views/public/*.ejs | sort -rn | head -10
wc -l appredueri_backend/src/views/public/portal/*.ejs | sort -rn
wc -l appredueri_backend/src/services/*.js | sort -rn | head -10
wc -l appredueri_backend/src/public/css/*.css | sort -rn
wc -l ofai_flutter/lib/**/*.dart 2>/dev/null | sort -rn | head -10
```

### Separation of Concerns
- [ ] `web.js` mixes: page rendering + AJAX endpoints + business portal logic + subscription management
  - **Recommended split**: web-pages.js, web-ajax.js, web-portal.js
- [ ] `manage.ejs` mixes: HTML + CSS + JS + Chart.js + multiple sections
  - **Recommended split**: partial templates per section
- [ ] `main.css` monolith: all styles in one file
  - **Recommended split**: base.css, components.css, pages.css, portal.css

### Coupling Analysis
- [ ] `tiers.js` caches plans in memory — verify TTL and invalidation
- [ ] `cronJobs.js` imports from multiple services — acceptable (coordinator pattern)
- [ ] `offerService.js` handles both creation and gamification — consider splitting
- [ ] `index.js` configures everything — consider separate config files

## Scan 3: Test Debt

```bash
# Backend tests
ls appredueri_backend/test/ 2>/dev/null || echo "⚠️ NO BACKEND TESTS"
ls appredueri_backend/__tests__/ 2>/dev/null || echo "⚠️ NO BACKEND TESTS"

# Flutter tests
ls ofai_flutter/test/ 2>/dev/null
find ofai_flutter/test -name "*_test.dart" 2>/dev/null | wc -l

# Coverage
cd ofai_flutter && "C:/dev/flutter/bin/flutter.bat" test --coverage 2>/dev/null
```

## Scan 4: Documentation Debt

- [ ] API documentation (OpenAPI/Swagger) — EXISTS? Probably not
- [ ] Database ERD — EXISTS? Probably not (schema in db-architect.md agent)
- [ ] Deployment guide — `deploy-verify.md` exists
- [ ] Environment setup guide — `.env.example` exists
- [ ] Architecture Decision Records — none

## Debt Scoring

Foloseste formula: **Impact × Effort = Priority**

| Impact | Definition |
|--------|-----------|
| 5 | Blocks feature development, causes bugs |
| 4 | Significantly slows development |
| 3 | Moderate friction, occasional issues |
| 2 | Minor inconvenience |
| 1 | Cosmetic, no real impact |

| Effort | Definition |
|--------|-----------|
| 1 | < 1 hour |
| 2 | 1-4 hours |
| 3 | 1-2 days |
| 4 | 3-5 days |
| 5 | > 1 week |

**Priority = Impact / Effort** (higher = do first)

## Output

```
=== Tech Debt Report — OFAI ===
Date: YYYY-MM-DD

## Summary
Total debt items: N
By category: X code, Y architecture, Z test, W documentation

## Top 10 Priority Items
| # | Item | Impact | Effort | Priority | Category |
|---|------|--------|--------|----------|----------|
| 1 | Split web.js | 5 | 4 | 1.25 | Architecture |
| 2 | Add backend tests | 4 | 4 | 1.00 | Test |
| ... | ... | ... | ... | ... | ... |

## Quick Wins (Effort ≤ 2, Impact ≥ 3)
- ...

## TODOs Found
- file:line — description

## Recommendations
1. Sprint 1: Quick wins (1-2 days total)
2. Sprint 2: Split web.js into modules (3-5 days)
3. Sprint 3: Add critical path tests (3-5 days)
4. Backlog: CSS split, API docs, ERD generation
```
