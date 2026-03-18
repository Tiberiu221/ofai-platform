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
    routes/         # Express route files (23 total)
      web.js                  # Main web routes (~2050 lines)
      web-auth.js             # Web auth (split from web.js)
      web-account-api.js      # Web account/profile API (split from web.js)
      web-portal-api.js       # Portal analytics/management API (split from web.js, ~2100 lines)
      web-shared.js           # Shared web utilities
      business-portal.js      # Business owner portal (~1600 lines)
      admin.js                # Admin panel (~2400 lines)
      offers.js, businesses.js, reviews.js, users.js  # Mobile API
      auth.js, favorites.js, subscriptions.js         # Mobile API
      push-tokens.js, businessRequests.js             # Mobile API
      offer-requests.js       # Pinch feature
      reports.js              # User report system
      billing.js              # Stripe billing (expanded with full webhook + subscription lifecycle)
      collections.js          # Curated collections API
      saved-searches.js       # Saved searches with alerts
      categories.js, cities.js  # Static data
    middleware/     # Auth, CSRF, tierAuth.js (7 files)
    helpers/        # tiers.js (subscription tier logic), notificationPrefs.js
    services/       # Core services + LLM sub-directory
      cronJobs.js, email.js, offerService.js, stripe.js, cloudinary.js
      badgeService.js, gamification.js, pushNotifications.js
      accountDeletion.js, sentry.js, n8n.js, subscriptionService.js
      llm/          # AI services (anthropicClient, businessValidation, offerValidation, summarization, prompts)
    migrations/     # SQL migration files (006-061)
    views/          # EJS templates
      public/portal/manage.ejs          # Main business management portal (LARGE file ~2250 lines)
      public/portal/partials/           # 7 portal tab partials (_tab-info, _tab-oferte, _tab-catalog, _tab-recenzii, _tab-statistici, _tab-subscription, _tab-support)
      public/business-detail.ejs        # Consumer business page (hours + catalog display)
    public/css/
      main.css                # Import loader (7 @imports)
      sections/               # 7 CSS sections (base, layout, home, listings, detail-pages, account, enhancements)
      portal.css              # Business portal styles
      admin.css               # Admin panel styles
      onboarding.css          # Onboarding page styles
    public/.well-known/       # Deep link config (apple-app-site-association, assetlinks.json)
ofai_flutter/
  lib/
    screens/        # 18 screen directories (added collection_detail, saved_searches, my_reports, preferences)
    models/         # 12 data models (+collection, report, saved_search)
    providers/      # 18 state providers (+collections, saved_searches, search_history, notification_preferences, reports, recently_viewed)
    core/network/   # API client (ApiClient, ApiEndpoints, ApiExceptions)
    core/storage/   # SharedPreferences, SecureStorage
    services/       # Push notifications, etc.
    widgets/        # Reusable widgets (+flash_countdown_badge)
docs/plans/         # Implementation plans
  subscriptions/    # 17 subscription plan docs (00-16)
  flutter/          # 5 Flutter plan docs (gaps, scorcard, tier1-3)
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
- **manage.ejs is HUGE** (~2250 lines) - be careful with edits, check closing divs
- **Portal tab partials:** Catalog tab is in `_tab-catalog.ejs`, Info tab in `_tab-info.ejs`
- **Column collisions:** `SELECT bs.*, sp.*` in tiers.js causes id/created_at collisions - use explicit aliases
- **CSRF:** Web portal routes require X-CSRF-Token; webhook routes must skip CSRF
- **Stripe webhooks:** Need raw body — index.js skips `express.json()` for `/billing/webhook` path
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
- **CSS split:** `main.css` is now just an import loader; actual styles in `css/sections/` (7 files). Portal/admin/onboarding have separate CSS files
- **web.js split:** Split into 4 sub-routers: `web.js`, `web-auth.js`, `web-account-api.js`, `web-portal-api.js` + `web-shared.js` utility
- **LLM services:** AI validation/moderation in `services/llm/` (5 files). Uses Anthropic Claude API via `anthropicClient.js`
- **Route count:** 23 route files total — don't forget to update both web and mobile routes when changing shared logic

## Language
- UI text and user-facing strings: Romanian
- Code, comments, commit messages: English
- Docs/plans: Romanian

## Current State (18 March 2026)
- Subscription system (Plans 00-16) fully planned with docs
- Audit #8+#9+#10 fixes: ALL applied (v0.9.0+ — 110+ fixes total)
- Migrations up to **063** (flash_deals, notification_preferences, saved_searches, collections, stripe_price_ids, referral_system)
- Business portal (manage.ejs ~2400 lines) — 7 tabs split into partials
- web.js split into 4 sub-routers + web-shared.js utility
- main.css split into 7 section files + loader
- **Opening Hours:** Per-location schedules, 24h select dropdowns, consumer Deschis/Închis badge
- **Unified Catalog:** Categories + items CRUD, CSV import, consumer display with category tabs
- **Concierge Onboarding:** Standard+ tier, request form + file upload, admin queue
- **Report System:** User reports with categories, admin review queue, Flutter "My Reports" screen
- **AI Validation:** Business validation (two-pass), offer moderation, review summarization via Claude API
- **Location Management:** Multi-location support, Google Maps URL parsing
- **Flash Deals:** flash_expires_at on offers, countdown badge widget, Home section
- **Notification Preferences:** Granular per-category toggles (daily, flash, weekly, marketing)
- **Saved Searches:** Save query+filters, alert on new matches, Flutter screen + provider
- **Collections:** Curated editorial lists, admin CRUD, Flutter collection detail screen
- **Social Proof Badges:** "Nou", "Se termina curand", trending badges on offer cards
- **Recently Viewed:** Local storage of last viewed offers/businesses, Home section
- **Search History:** Persistent local search history on Explore
- **Gamification:** Backend active (points, levels, streak tracked in DB), UI hidden — only badges visible on Account screen
- **Pinch Social Pressure:** Request count with fire icon on business detail
- **Weekly Digest:** Sunday 19:00 push with personalized offer count per city
- **Deep Links:** apple-app-site-association + assetlinks.json served, AndroidManifest intent filters, iOS entitlements
- **Pull-to-Refresh:** On both offer and business detail screens
- **Responsive Quick Wins:** Categories grid adapts to tablet width
- **OG Tags:** Backend has full Open Graph meta tags (head.ejs) for rich share previews
- **Billing/Stripe:** PRODUCTION READY — webhooks on Railway, full subscription lifecycle
  - Checkout (Free → Standard/Premium), upgrade, downgrade, cancel, reactivate
  - Monthly + yearly billing toggle in portal
  - Prorated upgrades, cycle switch (monthly ↔ yearly)
  - Webhook idempotency (dedup on all 4 handlers)
  - Price ID lookup (stripe_price_monthly_id + stripe_price_yearly_id)
  - current_period_end synced from Stripe after every plan change
  - Reactivate endpoint (undo pending cancellation)
  - Business selector modal on /preturi for multi-business owners
  - Tier badges (Premium/Standard) on portal dashboard cards + pricing modal
  - CTA action row in subscription comparison table
- **Category Feed:** Cron + API + Flutter home (web home version not implemented)
- **Referral System:** referral_code on users, /r/:code web redirect, Flutter "Invită prieteni" on Account, deep links, 50 points per referral (backend only, not shown in UI)
- **Rich Share:** OG tags passed in offer + business detail renders, Flutter uses Share.shareUri()
- **Report Auto-Flag:** ≥3 reports → email admin, ≥10 → auto-deactivate business
- **Offline Indicator:** connectivity_plus StreamProvider + red banner "Ești offline" in app shell
- **"Gestionează pe Web" Banner:** Shows on business_detail_screen for owners, links to portal
- Express pinned to ~5.1.0
- 23 route files, 18 providers, 63 migrations

### Remaining Gaps
- Gamification UI hidden — backend tracks points/levels but not shown to users (can re-enable later)
- Stripe: go-live with real keys (switch from test to live mode)
- Post-redemption review cron: implemented but not tested in production
