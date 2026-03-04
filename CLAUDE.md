# OFAI (Oferte AI) - Project Instructions

## Project Overview
OFAI is a Romanian local deals/offers platform connecting consumers with verified businesses. It has three components:
- **Backend:** Node.js/Express API with PostgreSQL, EJS server-side rendering (`appredueri_backend/`)
- **Flutter App:** Consumer-facing mobile app (`ofai_flutter/`)
- **Scraping:** Google Maps data pipeline (`scripts/scraping/`)

## Tech Stack
- **Backend:** Node.js, Express, PostgreSQL, EJS templates, Google Cloud Storage, Firebase (push notifications)
- **Mobile:** Flutter/Dart
- **DB:** PostgreSQL on Railway
- **Hosting:** Railway (backend), planned for production

## Project Structure
```
appredueri_backend/
  src/
    routes/         # Express route files (business-portal.js, web.js, offers.js, admin.js, subscriptions.js, billing.js)
    middleware/     # Auth, CSRF, tierAuth.js
    helpers/        # tiers.js (subscription tier logic)
    services/       # cronJobs.js, email.js, offerService.js, stripe.js
    migrations/     # SQL migration files (001-040+)
    views/          # EJS templates
      public/portal/manage.ejs  # Main business management portal (LARGE file)
ofai_flutter/
  lib/
    screens/        # Flutter screens
    models/         # Data models
    providers/      # State management
    core/network/   # API client
docs/plans/         # Implementation plans
  subscriptions/    # 17 subscription plan docs (00-16)
```

## Key Architectural Decisions
1. **3-Tier Subscription System:** Free / Standard (49 RON/mo) / Premium (199 RON/mo)
2. **Tier helpers:** `src/helpers/tiers.js` - `getBusinessTier()`, `hasFeature()`, `checkLimit()`
3. **Tier middleware:** `src/middleware/tierAuth.js` - `attachTier()`, `requireFeature()`, `requireLimit()`
4. **Grandfather rule:** NEVER delete existing data when downgrading tiers
5. **Feature flag:** `TIER_GATING_ENABLED` env var for phased rollout
6. **Dual routes:** Offer creation exists in BOTH `web.js` AND `business-portal.js` - always gate both

## Development Commands
```bash
# Backend
cd appredueri_backend && node src/index.js     # Start server (port 4000)
cd appredueri_backend && npm install            # Install deps

# Flutter
cd ofai_flutter && flutter analyze --no-pub     # Lint
cd ofai_flutter && flutter run                  # Run app

# Database
psql $DATABASE_URL                              # Connect to DB
```

## Important Gotchas
- **manage.ejs is HUGE** (~2000+ lines) - be careful with edits, check closing divs
- **Column collisions:** `SELECT bs.*, sp.*` in tiers.js causes id/created_at collisions - use explicit aliases
- **CSRF:** Web portal routes require X-CSRF-Token; webhook routes must skip CSRF
- **Stripe webhooks:** Need raw body (express.raw), not parsed JSON
- **Prices in bani:** 4900 = 49.00 RON (integer cents, avoid floating point)
- **Badge sync:** Always call `syncBadgeType()` after subscription changes
- **Flutter hook:** PostToolUse hook runs `flutter analyze` on Edit/Write in ofai_flutter/

## Language
- UI text and user-facing strings: Romanian
- Code, comments, commit messages: English
- Docs/plans: Romanian

## Current State (March 2026)
- Subscription system (Plans 00-16) fully planned with docs
- Critical fixes (R01-R13) have been addressed
- Migrations up to 040
- Business portal (manage.ejs) is the web hub for business management
- Stripe integration is skeleton (not production-ready)
