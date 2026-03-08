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
    routes/         # Express route files (web-portal-api.js, business-portal.js, web.js, offers.js, admin.js, subscriptions.js, billing.js)
    middleware/     # Auth, CSRF, tierAuth.js
    helpers/        # tiers.js (subscription tier logic)
    services/       # cronJobs.js, email.js, offerService.js, stripe.js, cloudinary.js
    migrations/     # SQL migration files (001-054)
    views/          # EJS templates
      public/portal/manage.ejs          # Main business management portal (LARGE file ~1500 lines)
      public/portal/partials/           # Portal tab partials (_tab-info.ejs, _tab-catalog.ejs, etc.)
      public/business-detail.ejs        # Consumer business page (hours + catalog display)
ofai_flutter/
  lib/
    screens/        # Flutter screens
    models/         # Data models (business.dart, catalog.dart, etc.)
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
- **manage.ejs is HUGE** (~1500+ lines) - be careful with edits, check closing divs
- **Portal tab partials:** Catalog tab is in `_tab-catalog.ejs`, Info tab in `_tab-info.ejs`
- **Column collisions:** `SELECT bs.*, sp.*` in tiers.js causes id/created_at collisions - use explicit aliases
- **CSRF:** Web portal routes require X-CSRF-Token; webhook routes must skip CSRF
- **Stripe webhooks:** Need raw body (express.raw), not parsed JSON
- **Prices in bani:** 4900 = 49.00 RON (integer cents, avoid floating point)
- **Badge sync:** Always call `syncBadgeType()` after subscription changes
- **Flutter hook:** PostToolUse hook runs `flutter analyze` on Edit/Write in ofai_flutter/
- **Hours day_of_week:** DB uses 0=Monday, 6=Sunday (ISO). JS `getDay()` returns 0=Sunday → convert: `(jsDay + 6) % 7`
- **Hours timezone:** Consumer page (business-detail.ejs) uses `Europe/Bucharest` timezone for server-side badge calculation
- **Hours midnight:** `close_time = '00:00'` means midnight (end of day). Compare as `closeMins === 0 ? 1440 : closeMins`
- **Hours 24h format:** Portal uses `<select>` dropdowns (not `<input type="time">`) to guarantee 24h format regardless of OS locale
- **Portal JS scope:** All functions inside IIFE `(function() { ... })()`. Functions called from inline `onclick` MUST be on `window`
- **Portal CSS classes:** Use `form-input`, `form-select`, `form-textarea` (NOT `form-control`); buttons: `btn-accent`, `btn-secondary-portal`
- **`concierge-section` uses class** (not id) because it appears in multiple tabs → `querySelectorAll` in `applyTierGating()`

## Language
- UI text and user-facing strings: Romanian
- Code, comments, commit messages: English
- Docs/plans: Romanian

## Current State (8 March 2026)
- Subscription system (Plans 00-16) fully planned with docs
- Audit #8+#9 fixes: ALL applied
- Migrations up to **054** (business_hours, business_catalog, onboarding_requests)
- Business portal (manage.ejs) — tabs: Info, Oferte, **Catalog**, Recenzii, Statistici, Suport, Abonament
- **Opening Hours:** Per-location schedules, 24h select dropdowns, consumer display with Deschis/Închis badge
- **Unified Catalog:** Categories + items CRUD, CSV import (2-step: upload→preview→confirm), consumer display with category tabs
- **Concierge Onboarding:** Standard+ tier only, request form + file upload, admin queue at /admin/onboarding
- **Report System + AI Validation + Offer Moderation:** All implemented
- Stripe integration is skeleton (not production-ready)
- Express pinned to ~5.1.0
