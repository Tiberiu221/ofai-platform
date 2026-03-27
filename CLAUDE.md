# OFAI (Oferte AI) - Project Instructions

## Project Overview
OFAI is a Romanian local deals/offers platform connecting consumers with verified businesses. It has three components:
- **Backend:** Node.js/Express API with PostgreSQL, EJS server-side rendering (`appredueri_backend/`)
- **Flutter App:** Consumer-facing mobile app (`ofai_flutter/`)
- **Scraping:** Google Maps data pipeline (`scripts/scraping/`)

## Tech Stack
- **Backend:** Node.js, Express, PostgreSQL, EJS templates, Cloudinary (images), Firebase (push notifications), Stripe (billing), Anthropic Claude (AI)
- **Mobile:** Flutter/Dart
- **DB:** PostgreSQL on Railway
- **Hosting:** Railway (backend, production), Cloudflare (DNS/CDN)

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
    helpers/        # tiers.js, notificationPrefs.js, mapsParser.js, validate.js, jwt.js, gallery.js (6 files)
    services/       # Core services + LLM sub-directory
      cronJobs.js, email.js, offerService.js, stripe.js, cloudinary.js
      badgeService.js, gamification.js, pushNotifications.js
      accountDeletion.js, sentry.js, n8n.js, subscriptionService.js
      llm/          # AI services (anthropicClient, businessValidation, offerValidation, summarization, reviewSuggestions, prompts)
    migrations/     # SQL migration files (006-068)
    views/          # EJS templates
      public/portal/manage.ejs          # Main business management portal (LARGE file ~2250 lines)
      public/portal/partials/           # 8 portal tab partials (_tab-info, _tab-oferte, _tab-catalog, _tab-recenzii, _tab-statistici, _tab-subscription, _tab-support, _tab-tools)
      public/tools/svg-to-png.ejs        # SVG → PNG/JPEG converter tool
      public/business-detail.ejs        # Consumer business page (hours + catalog display)
      public/blog.ejs                   # Blog listing page
      public/blog-post.ejs              # Blog article detail page
      admin/blog.ejs                    # Admin blog list
      admin/blog-edit.ejs               # Admin blog create/edit form
    public/css/
      main.css                # Import loader (7 @imports)
      sections/               # 7 CSS sections (base, layout, home, listings, detail-pages, account, enhancements)
      portal.css              # Business portal styles
      admin.css               # Admin panel styles
      blog.css                # Blog listing + article styles
      onboarding.css          # Onboarding page styles
    public/.well-known/       # Deep link config (apple-app-site-association, assetlinks.json)
ofai_flutter/
  lib/
    screens/        # 26 screens in 16 directories (account, auth, business, home, explore, offer, collection, etc.)
    models/         # 13 data models (offer, business, user, review, category, city, catalog, collection, report, saved_search, business_request, category_feed, pagination)
    providers/      # 20 Riverpod providers (auth, offers, businesses, favorites, followed, reviews, collections, saved_searches, search_history, search_suggest, notification_preferences, reports, recently_viewed, category_feed, offer_requests, business_requests, gamification, location, connectivity, static_data)
    core/network/   # API client (ApiClient, ApiEndpoints, ApiExceptions)
    core/storage/   # SharedPreferences, SecureStorage
    core/theme/     # AppColors, AppTypography, AppSpacing, AppTheme, PageTransitions
    core/utils/     # Distance, Formatters, Interleave, Launchers
    services/       # Push notifications, analytics, error handler (3 files)
    widgets/        # 24 reusable widgets (cards, badges, forms, states, galleries, effects)
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
- **CSRF:** Web portal routes require X-CSRF-Token; webhook routes must skip CSRF; click tracking (`/api/web/clicks`) also requires CSRF (anonymous users get session cookie)
- **CSP nonce:** Helmet generates `res.locals.cspNonce` per request; all inline `<script>` tags MUST use `nonce="<%= cspNonce %>"` attribute
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
- **LLM prompt injection:** All user-supplied text in LLM prompts must be wrapped in `[USER_INPUT]...[/USER_INPUT]` fencing tags to prevent prompt injection
- **Route count:** 23 route files total, ~256 endpoints — don't forget to update both web and mobile routes when changing shared logic
- **Refresh token rotation:** Uses `SELECT ... FOR UPDATE` in a transaction to prevent race conditions from concurrent requests
- **Lenis smooth scroll:** `window.lenis` is global. Use `lenis.scrollTo(target, { offset: -80 })` instead of `scrollIntoView`. Use `lenis.stop()`/`lenis.start()` for modals. Horizontal scroll containers are NOT affected (Lenis is vertical only). If CDN fails, all code falls back to native via `if (window.lenis)` guards
- **Portal CSS `.booking-field`:** Has `display: none` in CSS — JS toggle MUST use `display: 'block'` (not `''`) to override
- **Cropper.js CDN:** Loaded conditionally when `loadPortalCss` is set; `cdn.jsdelivr.net` added to CSP `scriptSrc` + `styleSrc`
- **Booking fallback:** Consumer business-detail.ejs falls back to `business.phone`/`business.website` when `booking_phone`/`booking_url` are null
- **Image upload:** `accept="image/jpeg,image/png,image/webp"` on all upload inputs (not `image/*`); multer error handler in web-portal-api.js

## Language
- UI text and user-facing strings: Romanian
- Code, comments, commit messages: English
- Docs/plans: Romanian

## Current State (27 March 2026)

### Architecture & Codebase
- Express pinned to ~5.1.0
- 23 route files, ~256 endpoints, 20 providers, 68 migrations, 26 screens, 13 models, 24 widgets
- Audits #8+#9+#10+#11+#12 fixes: ALL applied (v0.9.0+ — 155+ fixes total)
- Business portal (manage.ejs ~2250 lines) — 8 tabs split into partials (including Tools tab)
- web.js split into 4 sub-routers + web-shared.js utility
- main.css split into 7 section files + loader

### Consumer Web Pages (25 pages)
- Home, Oferte, Business-uri, Ofertă detail, Business detail, Categorii, Orașe
- Colecția mea, Account, Setări, Preferințe notificări
- Auth: Login, Register, Forgot Password, Reset Password, Verify Code
- Legal: Termeni, Confidențialitate, Ajutor
- Business: Pentru Business (landing), Prețuri, Onboarding
- Blog: /blog listing + /blog/:slug article detail
- Error: 404, 500
- All pages responsive, dark theme, OG meta tags

### Admin Panel
- Dashboard, Users, Businesses, Offers, Reviews, Categories, Cities
- Business requests queue (concierge), Offer moderation queue, Reports queue
- AI review summaries, location management
- **Email Logs** — `/admin/emails` with filters per type/status, stats, env toggle visibility
- **Blog CMS** — `/admin/blog` list/create/edit/delete/toggle-publish, Cloudinary images, SEO fields

### Features — Implemented
- **Opening Hours:** Per-location schedules, 24h select dropdowns, consumer Deschis/Închis badge
- **Unified Catalog:** Categories + items CRUD, CSV import, consumer display with category tabs
- **Concierge Onboarding:** Standard+ tier, request form + file upload, admin queue
- **Report System:** User reports with categories, admin review queue, Flutter "My Reports" screen
- **AI Validation:** Business validation (two-pass), offer moderation, review summarization, review suggestions via Claude API
- **Location Management:** Multi-location support, Google Maps URL parsing
- **Flash Deals:** flash_expires_at on offers, countdown badge widget, Home section
- **Notification Preferences:** Granular per-category toggles (daily, flash, weekly, marketing)
- **Saved Searches:** Save query+filters, alert on new matches, Flutter screen + provider
- **Collections:** Curated editorial lists, admin CRUD, Flutter collection detail screen
- **Social Proof Badges:** "Nou", "Se termina curand", trending badges on offer cards
- **Recently Viewed:** Local storage of last viewed offers/businesses, Home section
- **Search History:** Persistent local search history on Explore
- **Pinch Social Pressure:** Request count with fire icon on business detail
- **Weekly Digest:** Sunday 19:00 push with personalized offer count per city
- **Deep Links:** apple-app-site-association + assetlinks.json served, AndroidManifest intent filters, iOS entitlements
- **Pull-to-Refresh:** On both offer and business detail screens
- **Responsive Quick Wins:** Categories grid adapts to tablet width
- **OG Tags:** Backend has full Open Graph meta tags (head.ejs) for rich share previews
- **Tier Badges:** Premium/Standard/Verified badges on ALL web pages (offer cards, business cards, offer detail hero + sidebar + similar, home page sections, deal of day, promoted, followed offers, top businesses)
- **Billing/Stripe:** PRODUCTION READY — webhooks on Railway, full subscription lifecycle
  - Checkout (Free → Standard/Premium), upgrade, downgrade, cancel, reactivate
  - Monthly + yearly billing toggle in portal
  - Prorated upgrades, cycle switch (monthly ↔ yearly)
  - Webhook idempotency (dedup on all 4 handlers)
  - Price ID lookup (stripe_price_monthly_id + stripe_price_yearly_id)
  - current_period_end synced from Stripe after every plan change
  - Reactivate endpoint (undo pending cancellation)
  - Business selector modal on /preturi for multi-business owners
  - Tier badges on portal dashboard cards + pricing modal
  - CTA action row in subscription comparison table
- **Category Feed:** Cron + API + Flutter home (web home version not implemented)
- **Referral System:** referral_code on users, /r/:code web redirect, Flutter "Invită prieteni" on Account, deep links, 50 points per referral (backend only, not shown in UI)
- **Rich Share:** OG tags passed in offer + business detail renders, Flutter uses Share.shareUri()
- **Report Auto-Flag:** ≥3 reports → email admin, ≥10 → auto-deactivate business
- **Offline Indicator:** connectivity_plus StreamProvider + red banner "Ești offline" in app shell
- **"Gestionează pe Web" Banner:** Shows on business_detail_screen for owners, links to portal
- **Lenis Smooth Scroll:** CDN-loaded (jsDelivr), duration 1.2s ease-out-quint, navbar/anchors/modals migrated, graceful fallback if CDN fails
- **Search Bar Overhaul:** Better results, highlights, keyboard nav, a11y, clickable search icon submits form
- **CSP Nonce Migration:** Helmet CSP with per-request nonce for inline scripts
- **CSRF + Refresh Token:** CSRF re-enabled on click tracking, refresh token race condition fixed with `SELECT ... FOR UPDATE` transaction
- **SEO:** robots.txt, dynamic sitemap.xml (offers+businesses+blog posts+lastmod), canonical URLs on all pages, pagination rel=next/prev, JSON-LD (Organization, Offer, LocalBusiness, ItemList, BreadcrumbList, Product, Article), gzip compression, font preloading, duplicate content prevention (noindex on filtered/auth pages)
- **Google Analytics 4:** `GA_MEASUREMENT_ID` env var, custom events (favorite, follow, promo_code_reveal, business_action), CSP whitelisted
- **Logo:** OFAI wordmark SVG (`ofai-wordmark.svg` with bg for favicon/OG, `ofai-wordmark-nobg.svg` without bg for navbar/auth/footer)
- **User Activity Tracking:** `last_active_at` column updated on every authenticated request (throttled max 1x/hour) via web + mobile auth middleware
- **Blog/Content System:** Full CMS with blog_posts + blog_categories tables, admin CRUD, public /blog listing + /blog/:slug detail, featured first card, breadcrumbs, reading time, CTA, related posts, SEO (canonical, OG article, JSON-LD Article), sitemap integration, in-memory cache (15min list, 30min post), Unsplash images, 8 initial SEO posts across 5 categories
- **500 Error Page:** Custom 500.ejs with try/catch fallback, dev stack trace, matches 404 design
- **Logo Crop Tool:** Cropper.js circular crop modal for logo uploads, zoom slider, "Încadrează tot" (fit all) button, auto-detects background color for fill
- **Portal Tools Tab:** "Tool-uri" tab with SVG → PNG/JPEG converter (100% client-side, Canvas API, presets for Logo/Cover sizes)
- **Image Quality Upgrade:** 2x retina resolutions (logo 800px, cover 2400×1200, gallery 1920×1280, offer 1200×900), auto:best quality, 10MB upload limit
- **Gallery Limits Update:** Free tier 8 images (was 3), Standard 16 (was 8), Premium unlimited
- **Booking Simplification:** Booking type selection auto-uses profile data (phone/website) with "Schimbă" link to override; consumer page falls back to profile data when booking-specific fields are null
- **Portal Dashboard:** "Adaugă alt business" card for multi-business owners
- **Login Redirect:** Auth redirects to homepage (/) instead of /cont, new Google users still go to /onboarding
- **Multer Error Handler:** User-friendly error messages for file type/size rejections on gallery uploads
- **Portal Hint Texts:** Explanatory hints on booking section ("va apărea un card pe pagina business-ului"), opening hours ("va fi afișat cu status Deschis/Închis"), and image uploads (format + resolution recommendations)

### Features — Intentionally Hidden
- **Gamification UI:** Backend active (points, levels, streak, 10+ badge types tracked in DB), UI intentionally hidden — DO NOT re-enable without explicit request. Only badges visible on Account screen.

### Email System (12 types)
- **Transactional (9):** Welcome, password reset, business approved/rejected, offer approved/rejected, premium support welcome, admin onboarding notification, generic, payment failed
- **Engagement (3):** Weekly digest email, trial expiration warning (3 days before), re-engagement (14+ days inactive)
- Service: Resend API with graceful fallback
- `email_logs` table tracks ALL sent emails (admin visible at `/admin/emails`)
- `logEmail()` helper for audit trail on new engagement emails
- Rate limiting: 150ms delay between batch sends in cron jobs
- ENV toggles: `ENABLE_WEEKLY_DIGEST`, `ENABLE_TRIAL_WARNING`, `ENABLE_REENGAGEMENT` (set `=false` to disable)

### Cron Jobs (17 total)
- Token cleanup (daily 03:00), push log cleanup (daily 03:15)
- Category rankings (every 2 days), weekly digest push+email (Sunday 19:00 RO)
- Flash deal expiration (every 5min), review summary batch (daily 08:00 UTC), business deletion (soft delete)
- Subscription expiration check (daily 04:00 UTC)
- Deal of day push (daily 09:00 UTC), post-redemption review prompt (daily 10:00 UTC)
- Saved search alerts (daily 11:00 UTC)
- **Trial expiration warning email** (daily 09:00 UTC — 3 days before trial ends)
- **Re-engagement email** (Tuesday 10:00 UTC — users inactive 14-90 days, max 1/30 days)

### Monitoring & Error Handling
- Sentry error tracking (production)
- Click/offer/reveal tracking (internal analytics)
- Google Analytics 4 — controlled by `GA_MEASUREMENT_ID` env var, custom events on favorites/follows/promo reveals/booking actions
- 404 + 500 error pages
- **Missing:** conversion funnel tracking in GA4

### Security Audit History
- **Audit #11 (20 Mar):** 92 findings, 25 fixes (commit `7a040ac`)
- **Audit #12 (24 Mar):** 19 fixes + CSP nonce migration (commit `47fcf7b`) + performance indexes (migration 064)

### Remaining Gaps
- **Search:** Basic keyword matching only — no full-text (pg_trgm), no fuzzy/typo tolerance, no distance-based filtering
- **Email engagement logging:** `logEmail()` only on 3 new engagement emails — existing 9 transactional emails not yet logged to `email_logs` table
- **Redis cache:** Planned (see docs/plans/2026-03-23-redis-cache-plan.md), not implemented
- **Rate limiter:** In-memory only, resets on deploy (Redis plan will address)
- **Stripe:** Still on test keys — go-live with real keys pending
- **Testing:** Zero automated tests (no unit, integration, or e2e) — risk for regressions
- **Referral dashboard:** Backend tracks referrals but user can't see their invite stats
- **Post-redemption review cron:** Implemented but not tested in production
- **Offline/PWA:** Connectivity indicator exists but no service worker or local caching
- **i18n:** All strings hardcoded in Romanian — no multi-language support
