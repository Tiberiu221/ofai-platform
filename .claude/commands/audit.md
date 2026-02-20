# Full Project Audit

Lanseaza un audit complet al intregului proiect OFAI. Citeste mai intai memory files (MEMORY.md) pentru context, apoi lanseaza TOTI agentii in paralel.

## Agenti de lansat (TOTI IN PARALEL, run_in_background: true)

### 1. Backend Audit (code-reviewer agent, model: sonnet)
Audiaza toate fisierele din `appredueri_backend/src/`:
- **Routes** (src/routes/) — bugs, security, SQL injection, dead code, duplicate logic (web.js vs business-portal.js), missing auth middleware
- **Middleware** (src/middleware/) — auth edge cases, missing checks, optionalAuth usage
- **Services** (src/services/) — email, push, cloudinary, badges, cron, offerService
- **Helpers** (src/helpers/) — validation gaps, JWT issues
- **Config** — index.js setup, environment handling, CSRF config
- Verifica: offers table NU are created_at, business_images are BOTH image_filename si image_url
- Verifica: business ownership via user_businesses (NU owner_id), followed_businesses (NU subscriptions)
- Verifica: analytics endpoints (offer-views, clicks with action_type) au auth + ownership check

### 2. Flutter Audit (code-reviewer agent, model: sonnet)
Audiaza toate fisierele din `ofai_flutter/lib/`:
- **Models** — JSON parsing, null safety, isVerified, badges, profilePicture fields
- **Providers** — Riverpod patterns, memory leaks, race conditions, prefsActive state
- **Screens** — widget build issues, missing dispose(), navigation bugs, preference pill
- **Widgets** — performance, unnecessary rebuilds
- **Core** — Dio interceptor, storage, theme, utils
- Verifica: FutureProvider cache invalidation, DM Serif Display fara fontWeight, mounted checks

### 3. Web Frontend Audit (code-reviewer agent, model: sonnet)
Audiaza toate fisierele din `appredueri_backend/src/views/` + `src/public/`:
- **EJS Templates** — XSS (<%- vs <%=), broken links, accessibility, dead references
- **Portal manage.ejs** — Chart.js dropdowns, var hoisting, IIFE state management
- **CSS** (main.css) — dead rules, specificity issues, responsive gaps
- **JS** (main.js) — bugs, race conditions, fetch error handling, CSRF helpers
- **Preference pills** — oferte.ejs, business-uri.ejs, preferinte.ejs returnTo flow

### 4. Database Audit (code-reviewer agent, model: sonnet)
Audiaza toate fisierele din `appredueri_backend/src/migrations/`:
- ALL migrations (001-027) — missing indexes, FK constraints, naming conventions
- Cross-reference SQL queries in routes cu schema-ul real
- Connection pool settings, SSL, statement timeout
- Orphaned tables/columns
- Analytics tables: business_views, offer_views, business_clicks — index coverage

### 5. Config & Infrastructure Audit (code-reviewer agent, model: sonnet)
Audiaza configuratii din intregul proiect:
- **package.json** (backend) — outdated/unused/missing deps
- **pubspec.yaml** (Flutter) — outdated deps, version constraints
- **Android config** — build.gradle, AndroidManifest, google-services.json
- **.gitignore** — missing entries, sensitive files
- **Scripts** (scraping, seed) — hardcoded credentials, error handling
- **Environment vars** — JWT_SECRET, FIREBASE_ADMINSDK_JSON, GOOGLE_CLIENT_ID presence

## Dupa ce termina TOTI agentii

1. **Consolideaza** toate findings-urile intr-un raport structurat
2. **Categorizeaza** pe severitate: CRITICAL > HIGH > MEDIUM > LOW
3. **Actualizeaza memory files** — insights noi in MEMORY.md
4. **Afiseaza** rezumatul utilizatorului cu top findings si actiuni recomandate
