# Full Project Audit

Lanseaza un audit complet al intregului proiect OFAI. Citeste mai intai HANDOFF_DOCUMENT.md si memory files pentru context, apoi lanseaza TOTI agentii in paralel.

## Agenti de lansat (TOTI IN PARALEL, run_in_background: true)

### 1. Backend Audit (code-reviewer agent, model: sonnet)
Audiaza toate fisierele din `appredueri_backend/src/`:
- **Routes** (src/routes/) — bugs, security, SQL injection, dead code, duplicate logic (web.js vs business-portal.js)
- **Middleware** (src/middleware/) — auth edge cases, missing checks
- **Services** (src/services/) — email, push, cloudinary, sentry, n8n
- **Helpers** (src/helpers/) — validation gaps, JWT issues
- **Config** — index.js setup, environment handling
- Verifica: offers table NU are created_at, business_images are BOTH image_filename si image_url

### 2. Flutter Audit (code-reviewer agent, model: sonnet)
Audiaza toate fisierele din `ofai_flutter/lib/`:
- **Models** — JSON parsing, null safety
- **Providers** — Riverpod patterns, memory leaks, race conditions
- **Screens** — widget build issues, missing dispose(), navigation bugs
- **Widgets** — performance, unnecessary rebuilds
- **Core** — Dio interceptor, storage, theme, utils
- Verifica: FutureProvider cache invalidation, DM Serif Display fara fontWeight

### 3. Web Frontend Audit (code-reviewer agent, model: sonnet)
Audiaza toate fisierele din `appredueri_backend/src/views/` + `src/public/`:
- **EJS Templates** — XSS (<%- vs <%=), broken links, accessibility, dead references
- **CSS** (main.css) — dead rules, specificity issues, responsive gaps
- **JS** (main.js) — bugs, race conditions, fetch error handling, global namespace
- **Footer links** — verifica daca sunt inca pe `#`

### 4. Database Audit (code-reviewer agent, model: sonnet)
Audiaza toate fisierele din `appredueri_backend/src/migrations/`:
- ALL migrations (001-022) — missing indexes, FK constraints, naming conventions
- Cross-reference SQL queries in routes cu schema-ul real
- Connection pool settings, SSL, statement timeout
- Orphaned tables/columns

### 5. Config & Infrastructure Audit (code-reviewer agent, model: sonnet)
Audiaza configuratii din intregul proiect:
- **package.json** (backend) — outdated/unused/missing deps
- **pubspec.yaml** (Flutter) — outdated deps, version constraints
- **Android config** — build.gradle, AndroidManifest, google-services.json
- **.gitignore** — missing entries, sensitive files
- **Scripts** (scraping, seed) — hardcoded credentials, error handling
- **React Native legacy** (appredueri_mobile/) — cleanup status

## Dupa ce termina TOTI agentii

1. **Consolideaza** toate findings-urile intr-un raport structurat
2. **Categorizeaza** pe severitate: CRITICAL > HIGH > MEDIUM > LOW
3. **Actualizeaza HANDOFF_DOCUMENT.md** — adauga sectiune "AUDIT FINDINGS" cu data
4. **Actualizeaza memory files** — insights noi in MEMORY.md, web-patterns.md, flutter-details.md
5. **Afiseaza** rezumatul utilizatorului cu top findings si actiuni recomandate
