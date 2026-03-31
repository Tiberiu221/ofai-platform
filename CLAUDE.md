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
    migrations/     # SQL migration files (006-071)
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

## Investigation Workflow
When a bug, unexpected behavior, or "something doesn't make sense" is reported:
1. **Explore** — Trace the full data flow (form → API → DB → display). Read actual code.
2. **Diagnose** — Query DB to see actual data state. Compare portal vs DB vs display.
3. **Plan** — Enter plan mode. Group fixes by priority phases (CRITICAL → MODERATE).
4. **Present** — Show root cause + impact + plan summary. Wait for approval.
5. **Fix** — Implement phase by phase. Backfill corrupted data. Verify each phase.
- Use `/investigate` slash command to trigger this workflow
- Never jump to fixing symptoms without understanding the full data path

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
- **CSS split:** `main.css` is now just an import loader with `?v=YYYYMMDD` cache-busting on all `@import` URLs; actual styles in `css/sections/` (7 files). Portal/admin/onboarding have separate CSS files. `<link>` tag uses `cacheBust = Date.now()` from server start. Update `?v=` param in main.css after CSS changes.
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
- **i18n EJS:** Use `<%= t('key') %>` for escaped output, `<%- t('key') %>` for HTML content (e.g., GDPR consent with links). Language switcher uses `?lang=ro`/`?lang=en` query param + `ofai_lang` cookie.
- **i18n Flutter:** Use `AppLocalizations.of(context)!.key` to access translations. Import `package:flutter_gen/gen_l10n/app_localizations.dart`. Run `flutter gen-l10n` after modifying ARB files.
- **Service Worker:** `sw.js` in `src/public/` — never cache API/auth/billing paths. Update `CACHE_NAME` version when changing cached assets.
- **Search helper:** `buildFuzzySearch(columns, paramIdx)` in `src/helpers/search.js` — apply `similarity: true` only on short columns (title, name), NOT on description (too noisy for trigrams)
- **businesses.is_active:** Column does NOT exist on `businesses` table. Do NOT use in WHERE clauses. Use subscription status or offer counts to determine activity.
- **offers.updated_at:** Column does NOT exist. Use `created_at` or `start_date` instead.
- **review_responses.responded_by:** Column missing from migrations but referenced in INSERT code — will crash on review response submit
- **Admin pages + CSP nonce:** Admin templates use `layout-top.ejs` (not `partials/head.ejs`). Inline `<script>` tags in admin MUST include `nonce="<%= cspNonce %>"` — `cspNonce` is available via `res.locals`
- **Multi-platform booking:** `bookingPlatforms.js` has 14 platforms. Portal uses `initBookingMethods()` — must be called AFTER function definition (was bug: called before). Offer form uses `of-input` class (not `form-input` — portal.css not loaded on offer form)

## Language
- UI text and user-facing strings: Romanian
- Code, comments, commit messages: English
- Docs/plans: Romanian

## Current State (30 March 2026, post-masterplan)

### Architecture & Codebase
- Express pinned to ~5.1.0
- 23 route files, ~258 endpoints, 20 providers, 72 migrations, 26 screens, 13 models, 24 widgets
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
- **Analytics Dashboard** — `/admin/analytics` with Chart.js: MRR/ARR/churn, tier distribution, Free vs Paid, subscription history, user signups, business health, email engagement (cached 15min)

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
- **Pricing Page Cleanup:** Removed AI-sensitive features (Rezumat AI, Răspunsuri sugerate AI, Analize competitive) from public /preturi — visible only in portal subscription tab. Removed strikethrough/X items from Free card. Rezervări shows check for all tiers.
- **Analytics Tier Gating:** Period buttons (7/30/90 zile) now respect tier's `analytics_days` limit. Default period matches tier max (was hardcoded 30 for all). Backend already enforced via Math.min cap.
- **Fuzzy Search:** pg_trgm extension + `buildFuzzySearch()` helper combining ILIKE + similarity() across 5 search routes (web offers, web businesses, mobile offers, mobile businesses, search suggest). Typo tolerance with 0.15 threshold.
- **Backend Testing:** Jest + Supertest infrastructure with 19 tests (jwt helpers, tier normalization, search helper). `npm test` / `npm run test:coverage`. App exports via `require.main === module` guard.
- **Referral Dashboard:** `GET /users/me/referral-stats` API returns total referrals, points, recent list. Flutter bottom sheet enhanced with stat chips + referral history.
- **PWA Support:** Web app manifest (`/manifest.json`), service worker (`/sw.js`) with cache strategies (static=cache-first, HTML=network-first, API=network-only), offline fallback page, apple-touch-icon, theme-color meta.
- **i18n Complete:** Backend: i18next + fs-backend + http-middleware with RO/EN locale files (~717 keys, 26 namespaces), ALL 25 consumer EJS templates migrated, language switcher, cookie persistence. Flutter: flutter_localizations + ARB files (~180 keys), ALL 26 screens + 5 widgets localized. Provider/utility error strings remain hardcoded (no BuildContext available).
- **Admin Cron Testing:** `POST /admin/test-cron/review-prompt` endpoint to manually trigger post-redemption review cron.
- **Offer Detail Booking Button:** Actionable CTA (phone/whatsapp/url) in "Cum profiți de ofertă?" section — previously only showed text
- **Booking Type Normalization:** Migration 071 fixes `link`→`url` (20 businesses) + `NONE`→`none` (2 locations). Route handlers normalize at read time as defense in depth.
- **Pagination UX:** Sliding window (shows pages around current), prev/next arrows, scroll-to-top on both /oferte and /business-uri
- **Portal Tab Persistence:** localStorage fallback when URL hash missing (key: `portal_tab_{businessId}`)
- **Portal Offer Deletion:** Delete button + confirm dialog on offers tab (backend endpoint existed, UI was missing)
- **Gallery Reorder:** Arrow buttons (←→) on hover + PUT endpoint `/api/web/portal/:businessId/gallery/reorder`
- **Password UX:** Strength indicator (3-bar) on register, show/hide toggle on login + register
- **Cookie Banner:** "Refuză" button + GA4 disable on rejection
- **Email Audit Logging:** All 12 email types now use `logEmail()` for admin dashboard visibility
- **LLM Prompt Injection:** Complete `[USER_INPUT]` fencing on all 5 LLM services (~20 fields)
- **Onboarding UX:** Explanatory subtitles on city/category selection steps
- **Multi-Platform Booking:** 14 platforms (Telefon, WhatsApp, Booksy, Fresha, Airbnb, Booking.com, Calendly, Google, Treatwell, Planfy, Setmore, SimplyBook, Website propriu, Altul). Multi-select on business portal + offer form with inherit/custom toggle. Consumer branded buttons with platform colors. Migration 074 + 075.
- **Admin Analytics Dashboard:** `/admin/analytics` with Chart.js — MRR/ARR/churn cards, tier distribution doughnut, Free vs Paid breakdown, subscription history bar, user signups line chart, business health, email engagement. Cached 15min.
- **Web Auth Rate Limiting:** POST /login, /register, /forgot-password, /verify-code, /reset-password all rate-limited
- **Password Reset Web Flow:** GET /verify-code route + verify-code.ejs template for complete web password reset

### Features — Intentionally Hidden
- **Gamification UI:** Backend active (points, levels, streak, 10+ badge types tracked in DB), UI intentionally hidden — DO NOT re-enable without explicit request. Only badges visible on Account screen.

### Email System (12 types)
- **Transactional (9):** Welcome, password reset, business approved/rejected, offer approved/rejected, premium support welcome, admin onboarding notification, generic, payment failed
- **Engagement (3):** Weekly digest email, trial expiration warning (3 days before), re-engagement (14+ days inactive)
- Service: Resend API with graceful fallback
- `email_logs` table tracks ALL sent emails (admin visible at `/admin/emails`)
- `logEmail()` on ALL 12 email types (transactional + engagement) for full audit trail
- Rate limiting: 150ms delay between batch sends in cron jobs
- ENV toggles: `ENABLE_WEEKLY_DIGEST`, `ENABLE_TRIAL_WARNING`, `ENABLE_REENGAGEMENT` (set `=false` to disable)

### Cron Jobs (18 total)
- Token cleanup (daily 03:00), push log cleanup (daily 03:15)
- Category rankings (every 2 days), weekly digest push+email (Sunday 19:00 RO)
- Flash deal expiration (every 5min), review summary batch (daily 08:00 UTC), business deletion (soft delete)
- Subscription expiration check (daily 04:00 UTC)
- Deal of day push (daily 09:00 UTC), post-redemption review prompt (daily 10:00 UTC)
- Saved search alerts (daily 11:00 UTC)
- **Trial expiration warning email** (daily 09:00 UTC — 3 days before trial ends)
- **Re-engagement email** (Tuesday 10:00 UTC — users inactive 14-90 days, max 1/30 days)
- **Cloudinary orphaned image cleanup** (Sunday 05:00 UTC — dry-run by default, `CLOUDINARY_CLEANUP_DELETE=true` to delete)

### Monitoring & Error Handling
- Sentry error tracking (production)
- **Global error handlers:** `process.on('unhandledRejection')` + `process.on('uncaughtException')` with Sentry capture
- Click/offer/reveal tracking (internal analytics)
- Google Analytics 4 — controlled by `GA_MEASUREMENT_ID` env var, custom events on favorites/follows/promo reveals/booking actions
- 404 + 500 error pages
- **Missing:** conversion funnel tracking in GA4

### Security Audit History
- **Audit #11 (20 Mar):** 92 findings, 25 fixes (commit `7a040ac`)
- **Audit #12 (24 Mar):** 19 fixes + CSP nonce migration (commit `47fcf7b`) + performance indexes (migration 064)

### Recently Implemented (Masterplan, 30 Mar 2026)
- **Search:** pg_trgm extension + fuzzy search helper (`src/helpers/search.js`) across 5 routes — ILIKE + `similarity()` with 0.15 threshold, typo-tolerant
- **Testing:** Jest + Supertest infrastructure — 19 tests across 3 suites (jwt, tiers, search helpers), `npm test` / `npm run test:coverage`
- **Referral dashboard:** `GET /users/me/referral-stats` API + enhanced Flutter bottom sheet with stats + recent referrals
- **Post-redemption review cron:** Extracted to testable `runReviewPromptCron()`, admin test endpoint `POST /admin/test-cron/review-prompt`
- **PWA:** Web app manifest, service worker (cache-first static, network-first HTML, network-only API), offline.html fallback, CSP workerSrc
- **i18n backend:** i18next + i18next-http-middleware, `ro.json` + `en.json` (~60 keys), 4 templates migrated (navbar, footer, login, register), RO/EN language switcher
- **i18n Flutter:** flutter_localizations + ARB files (~25 keys), localization delegates configured, nav labels localized
- **Redis cache plan:** Documentation at `docs/plans/2026-03-23-redis-cache-plan.md`

### Resolved Gaps (as of 30 Mar 2026)
- **Fuzzy search:** ✅ pg_trgm + `buildFuzzySearch()` across 5 routes, trigram indexes, 0.15 threshold
- **Backend testing:** ✅ Jest + Supertest — 19 tests across 3 suites (jwt, tiers, search)
- **Referral dashboard:** ✅ API `GET /users/me/referral-stats` + Flutter bottom sheet with stats
- **PWA:** ✅ manifest.json + service worker (cache strategies) + offline.html fallback
- **Blog CMS:** ✅ Admin CRUD + public /blog + /blog/:slug + SEO + 8 seed posts
- **i18n complete:** ✅ Backend 717 keys (26 namespaces) + Flutter 180 keys — all 25 pages + 26 screens
- **Stripe config:** ✅ Env vars (`STRIPE_SECRET_KEY`), no hardcoded keys — swap to live when ready
- **Gamification UI:** ✅ Hidden intentionally (backend active, UI disabled by design)

### Remaining Gaps
- **Redis cache:** Planned (see docs/plans/2026-03-23-redis-cache-plan.md), not implemented — in-memory CacheService as interim
- **Rate limiter:** In-memory only, resets on deploy (Redis plan will address — same Redis instance)
- **Stripe live keys:** Config ready, still on test keys — go-live pending
- **Support WhatsApp:** Placeholder number `40700000000` — replace with real number before go-live
- **Search distance filtering:** pg_trgm done but no PostGIS/distance-based filtering yet
- **PWA icons:** Files exist but are 64x64 — need proper 192x192 and 512x512 icons
- **GA4 conversion funnel:** Basic events tracked (promo_reveal, business_action), full funnel missing
- **Backend test coverage:** Infrastructure exists but only helpers tested — no route/integration tests
