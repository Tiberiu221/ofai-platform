# Full Project Audit

Lanseaza un audit complet al intregului proiect OFAI. Citeste mai intai memory files (MEMORY.md) pentru context, apoi lanseaza TOTI agentii in paralel.

## Agenti de lansat (TOTI IN PARALEL, run_in_background: true)

### 1. Backend Audit (code-reviewer agent, model: sonnet)
Audiaza toate fisierele din `appredueri_backend/src/`:
- **Routes** (src/routes/ — 23 files) — bugs, security, SQL injection, dead code, duplicate logic
  - web.js (~2050 lines), web-auth.js, web-account-api.js, web-portal-api.js (~2100 lines), web-shared.js
  - business-portal.js (~1600 lines), admin.js (~2400 lines), billing.js, auth.js, offers.js, businesses.js
  - reports.js, collections.js, saved-searches.js, offer-requests.js, push-tokens.js
  - reviews.js, favorites.js, subscriptions.js, users.js, businessRequests.js, categories.js, cities.js
- **Middleware** (src/middleware/) — auth edge cases, missing checks, tierAuth.js gating
- **Services** (src/services/) — email, push, cloudinary, badges, gamification, cron, offerService, stripe, subscriptionService, accountDeletion
- **LLM Services** (src/services/llm/) — anthropicClient, businessValidation, offerValidation, summarization, prompts — CHECK FOR PROMPT INJECTION
- **Helpers** (src/helpers/) — validation gaps, JWT issues, tiers.js, notificationPrefs.js
- **Config** — index.js setup, Stripe raw body handling, CSRF config
- Verifica: offers table NU are created_at, business_images BOTH image_filename si image_url
- Verifica: business ownership via user_businesses, followed_businesses (NU subscriptions)
- Verifica: tier gating corect pe TOATE rutele (gallery limits, offer limits, promo codes, push, deal nominations)
- Verifica: Stripe webhook signature + idempotency, badge sync, cron jobs, billing lifecycle

### 2. Flutter Audit (code-reviewer agent, model: sonnet)
Audiaza toate fisierele din `ofai_flutter/lib/`:
- **Models** (12) — JSON parsing, null safety, badges, profilePicture, referralCode fields
- **Providers** (18) — Riverpod patterns, memory leaks, race conditions, new providers (collections, saved_searches, search_history, notification_preferences, reports, recently_viewed)
- **Screens** (18 directories) — widget build issues, dispose, navigation, deep links, offline handling
- **Widgets** — FlashCountdownBadge, SocialProofBadge, SubscriptionBadge
- **Core** — Dio interceptor, storage, theme, utils, connectivity
- Verifica: FutureProvider cache invalidation, DM Serif Display fara fontWeight, mounted checks

### 3. Web Frontend Audit (code-reviewer agent, model: sonnet)
Audiaza toate fisierele din `appredueri_backend/src/views/` + `src/public/`:
- **EJS Templates** — XSS (<%- vs <%=), broken links, accessibility
- **Portal manage.ejs** (~2250 lines) + **8 tab partials** in portal/partials/ (incl. _tab-tools.ejs) — IIFE state management, Chart.js
- **CSS sections/** (7 files) + portal.css + admin.css + onboarding.css — dead rules, specificity, responsive
- **JS** (main.js) — Lenis smooth scroll patterns, `window.lenis` guards, fetch error handling, CSRF
- **Portal CSS classes**: form-input/form-select (NOT form-control), btn-accent/btn-secondary-portal

### 4. Database Audit (code-reviewer agent, model: sonnet)
Audiaza toate fisierele din `appredueri_backend/src/migrations/`:
- ALL migrations (006-071) — missing indexes, FK constraints, naming conventions
- **Migration 058 conflict** — two files with same number (flash_deals AND category_rankings)
- **Migration 071** — booking_type normalization (link→url, NONE→none)
- Cross-reference SQL queries in routes cu schema-ul real
- New tables: reports, business_hours, business_catalog_*, onboarding_requests, notification_preferences, saved_searches, collections, collection_items, category_rankings, user_points
- Subscription tables integrity, badge sync, Stripe price ID columns
- Connection pool settings, SSL, statement timeout

### 5. Config & Infrastructure Audit (code-reviewer agent, model: sonnet)
Audiaza configuratii din intregul proiect:
- **package.json** — outdated/unused/missing deps (incl. stripe, @anthropic-ai/sdk)
- **pubspec.yaml** — outdated deps, version constraints
- **Android config** — build.gradle, AndroidManifest, deep link intent filters
- **.gitignore** — missing entries, sensitive files
- **Environment vars** — JWT_SECRET, FIREBASE_ADMINSDK_JSON, GOOGLE_CLIENT_ID, STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET, ANTHROPIC_API_KEY, TIER_GATING_DISABLED

### 6. Subscription & Billing Audit (code-reviewer agent, model: sonnet)
Audiaza complet sistemul de subscriptii (PRODUCTION READY):
- **tiers.js** — plan definitions, feature flags, limit enforcement, cache TTL
- **tierAuth.js** — middleware gating, TIER_GATING_DISABLED bypass, error responses
- **billing.js** — Stripe checkout, change-plan, reactivate, cycle switch, webhook handlers
- **stripe.js** — customer management, price mapping (stripe_price_monthly_id / stripe_price_yearly_id)
- **subscriptionService.js** — subscription lifecycle
- **cronJobs.js** — subscription expiry, deal nominations, category rankings, weekly digest
- **offerService.js** — promo code limit enforcement
- **business-portal.js** — tier-gated features (gallery, offers, push, analytics)
- Cross-check: toate feature flags din subscription_plans sunt verificate in cod

## Dupa ce termina TOTI agentii

1. **Consolideaza** toate findings-urile intr-un raport structurat
2. **Categorizeaza** pe severitate: CRITICAL > HIGH > MEDIUM > LOW
3. **Actualizeaza memory files** — insights noi in MEMORY.md
4. **Afiseaza** rezumatul utilizatorului cu top findings si actiuni recomandate
