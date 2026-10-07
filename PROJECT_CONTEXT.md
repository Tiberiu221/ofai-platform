# OFAI — Project Context Document
## Ultima actualizare: 26 Martie 2026 (v0.13.0 — GA4 + SEO + Tier Badges Everywhere)

> **Scop:** Document complet de context pentru sesiuni noi. Conține toată arhitectura, schema DB, API-uri, patterns și gotchas.
> Changelog detaliat per sesiune → vezi `HANDOFF_DOCUMENT.md` (v16, 1785 linii).

---

## 1. PROJECT OVERVIEW

**Nume:** OFAI — Platforma de oferte și reduceri din România
**Domeniu:** https://ofai.ro
**GitHub:** https://github.com/Tiberiu221/ofai

**Tech Stack:**
| Layer | Technology |
|-------|-----------|
| Backend | Express 5.1 + PostgreSQL + EJS templates |
| Mobile | Flutter 3.41 / Dart 3.11 (Android) |
| Hosting | Railway (auto-deploy on push to main) |
| DNS/CDN | Cloudflare (free, proxy ON) |
| Images | Cloudinary (upload/resize/delete, WebP output) |
| Email | Resend (welcome, password reset, business notifications) |
| Push | Firebase Cloud Messaging (FCM) + Expo (legacy) |
| AI/LLM | Anthropic Claude Haiku (review summarization, business validation) |
| Analytics | Google Analytics 4 (`GA_MEASUREMENT_ID` env var) |
| Error Tracking | Sentry |
| Automation | n8n (on Railway) |

**URLs:**
- **Production:** https://ofai.ro (Railway, DNS via Cloudflare CNAME)
- **API:** Same server as website (Express serves both EJS pages + REST API)
- **n8n:** https://n8n-production-d2f4.up.railway.app
- **Dev:** http://localhost:4000 (backend), Flutter emulator `10.0.2.2:4000`
- **Flutter SDK:** `C:\dev\flutter` (v3.41.0)

---

## 2. DIRECTORY STRUCTURE

```
OFAI/
├── appredueri_backend/           # Express.js backend + EJS website
│   ├── src/
│   │   ├── index.js              # Entry point (port 4000, middleware stack)
│   │   ├── db.js                 # PostgreSQL pool (max 20, SSL in prod)
│   │   ├── routes/               # 23 route files total
│   │   │   ├── web.js            # Main web routes (~2050 lines, split from original ~2900)
│   │   │   ├── web-auth.js       # Web auth endpoints (split from web.js)
│   │   │   ├── web-account-api.js # Web account/profile API (split from web.js)
│   │   │   ├── web-portal-api.js # Portal analytics/management API (split from web.js, ~2100 lines)
│   │   │   ├── web-shared.js     # Shared web utilities
│   │   │   ├── admin.js          # Admin panel (~2400 lines, Basic Auth, CRUD all entities)
│   │   │   ├── business-portal.js # Business owner portal (~1600 lines, cookie auth + ownership)
│   │   │   ├── auth.js           # Mobile auth (register, login, refresh, logout, Google)
│   │   │   ├── offers.js         # Mobile offers API (list, detail, feed, deal-of-day)
│   │   │   ├── businesses.js     # Mobile businesses API (list, detail, suggest)
│   │   │   ├── reviews.js        # Mobile reviews API (create, list, delete, respond)
│   │   │   ├── favorites.js      # Mobile favorites API (toggle, list)
│   │   │   ├── subscriptions.js  # Mobile subscriptions/follows API
│   │   │   ├── users.js          # Mobile user API (profile, picture, password, delete)
│   │   │   ├── push-tokens.js    # Push token registration (FCM + Expo)
│   │   │   ├── businessRequests.js # Business signup requests
│   │   │   ├── offer-requests.js # "Pinch" — request offers from businesses
│   │   │   ├── reports.js        # User report system
│   │   │   ├── billing.js        # Stripe billing
│   │   │   ├── collections.js    # Curated collections API
│   │   │   ├── saved-searches.js # Saved searches with alerts
│   │   │   ├── cities.js         # Cities list
│   │   │   └── categories.js     # Categories with business count
│   │   ├── middleware/
│   │   │   ├── auth.js           # Bearer token (mobile API)
│   │   │   ├── webAuth.js        # Cookie JWT (web pages, auto-refresh)
│   │   │   ├── businessAuth.js   # Bearer + business ownership
│   │   │   ├── businessWebAuth.js # Cookie + business ownership
│   │   │   ├── adminAuth.js      # HTTP Basic Auth
│   │   │   ├── rateLimiter.js    # 9 rate limiters (in-memory)
│   │   │   └── tierAuth.js      # Subscription tier gating (attachTier, requireFeature, requireLimit)
│   │   ├── services/
│   │   │   ├── offerService.js   # Shared offer creation (transaction, push, webhook)
│   │   │   ├── badgeService.js   # 10 badges, check & award logic
│   │   │   ├── gamification.js   # Points, streaks, daily login
│   │   │   ├── cronJobs.js       # 6 scheduled jobs (node-cron)
│   │   │   ├── cloudinary.js     # Image upload/delete/transform
│   │   │   ├── pushNotifications.js # Dual FCM + Expo routing
│   │   │   ├── email.js          # Resend email templates
│   │   │   ├── accountDeletion.js # GDPR cascade delete
│   │   │   ├── sentry.js         # Error tracking init
│   │   │   ├── n8n.js            # Webhook helper
│   │   │   ├── stripe.js         # Stripe integration
│   │   │   ├── subscriptionService.js # Subscription helpers
│   │   │   └── llm/              # AI services (5 files)
│   │   │       ├── anthropicClient.js  # Claude API wrapper
│   │   │       ├── businessValidation.js # Two-pass AI business validation
│   │   │       ├── offerValidation.js  # AI offer moderation
│   │   │       ├── summarizationService.js # Review summarization
│   │   │       ├── reviewSuggestions.js   # Review response suggestions
│   │   │       └── prompts.js          # LLM prompt definitions
│   │   ├── helpers/
│   │   │   ├── tiers.js          # Subscription tier logic (getBusinessTier, hasFeature, checkLimit)
│   │   │   ├── validate.js       # Input validation, pagination, password rules
│   │   │   ├── jwt.js            # Token generation (24h access, 30d refresh)
│   │   │   ├── mapsParser.js     # Google Maps URL parsing
│   │   │   ├── notificationPrefs.js # Notification preference logic
│   │   │   └── gallery.js        # Gallery image validation, tier-based limits
│   │   ├── views/
│   │   │   ├── public/           # 20+ EJS pages (home, oferte, login, account, etc.)
│   │   │   │   ├── portal/       # Business portal
│   │   │   │   │   ├── manage.ejs      # Main portal (~2250 lines, 7 tabs)
│   │   │   │   │   ├── dashboard.ejs   # Business list
│   │   │   │   │   ├── offer-form.ejs  # Create/edit offer
│   │   │   │   │   └── partials/       # 7 tab partials
│   │   │   │   │       ├── _tab-info.ejs, _tab-oferte.ejs, _tab-catalog.ejs
│   │   │   │   │       ├── _tab-recenzii.ejs, _tab-statistici.ejs
│   │   │   │   │       └── _tab-subscription.ejs, _tab-support.ejs
│   │   │   │   └── partials/     # head.ejs, navbar.ejs, footer.ejs
│   │   │   └── admin/            # Admin panel (businesses, offers, users, reviews, requests)
│   │   ├── public/
│   │   │   ├── css/
│   │   │   │   ├── main.css      # Import loader (7 @imports)
│   │   │   │   ├── sections/     # 7 CSS sections (base, layout, home, listings, detail-pages, account, enhancements)
│   │   │   │   ├── portal.css    # Business portal styles
│   │   │   │   ├── admin.css     # Admin panel styles
│   │   │   │   └── onboarding.css # Onboarding page styles
│   │   │   ├── js/main.js        # Client JS (~660 lines)
│   │   │   └── images/           # OG fallback SVG
│   │   └── migrations/           # SQL migrations 006-064
│   ├── scripts/
│   │   ├── seed-businesses.js    # Test data seeder
│   │   └── run-migration-production.js
│   └── package.json
│
├── ofai_flutter/                 # Flutter mobile app (Android)
│   ├── lib/
│   │   ├── main.dart             # Entry (Firebase init, ProviderScope)
│   │   ├── app.dart              # GoRouter (ShellRoute, auth redirects)
│   │   ├── core/
│   │   │   ├── network/          # ApiClient (Dio), ApiEndpoints, ApiExceptions
│   │   │   ├── storage/          # SecureStorage (tokens), Preferences (onboarding)
│   │   │   ├── theme/            # AppColors, AppTypography, AppSpacing, AppTheme
│   │   │   └── utils/            # Distance, Formatters, Launchers
│   │   ├── models/               # 13 models (Offer, Business, Catalog, User, Review, City, Category, BusinessRequest, Pagination, Collection, Report, SavedSearch, CategoryFeed)
│   │   ├── providers/            # 20 Riverpod providers (auth, offers, businesses, favorites, followed, gamification, reviews, offer_requests, business_requests, location, static_data, search_suggest, collections, saved_searches, search_history, notification_preferences, reports, recently_viewed, category_feed, connectivity)
│   │   ├── screens/              # 26 screens in 16 directories organized by feature
│   │   ├── services/             # PushNotifications, Analytics, ErrorHandler
│   │   └── widgets/              # OfferCard, BusinessCard, ReviewCard, etc.
│   ├── android/                  # Manifest, build.gradle, signing config
│   ├── test/                     # Unit + widget tests
│   └── pubspec.yaml
│
├── appredueri_mobile_old_ignore/ # Legacy React Native (DEPRECATED)
├── n8n-workflows/                # n8n exports (WF1 active)
├── HANDOFF_DOCUMENT.md           # Historical changelog (v16, 1785 lines)
├── PROJECT_CONTEXT.md            # ← ACEST DOCUMENT
└── .claude/                      # Claude Code config, agents, commands
```

---

## 3. DATABASE SCHEMA

**Connection:** `postgresql://postgres:REDACTED@REDACTED_DB_HOST/railway` (SSL)
**Pool:** max 20, idle 30s, statement timeout 10s

### Core Tables

**users**
- id, email, password_hash (NULL for Google users), first_name, last_name, phone, role (user/business_owner/admin)
- `preferred_city_ids` INTEGER[] — multi-city preference (migration 024)
- `preferred_category_ids` INTEGER[] — multi-category preference
- `google_id` VARCHAR UNIQUE — Google OAuth (migration 025)
- `profile_picture_url` TEXT — Cloudinary URL (migration 025)
- `show_picture_in_reviews` BOOLEAN DEFAULT TRUE (migration 026)
- `privacy_accepted_at`, `terms_accepted_at` — GDPR timestamps
- `banned_at` — User ban timestamp
- NOTE: old `preferred_city_id` (single) column kept for compat

**businesses**
- id, name, address, phone, website, lat, lng, logo_url, cover_image_url, description
- `category_id` FK, `city_id` FK
- `source` TEXT — 'manual' / 'seed' / 'scraped'
- `is_verified` BOOLEAN DEFAULT FALSE (migration 026)
- `verified_at` TIMESTAMPTZ (migration 026)

**offers**
- id, title, description, discount_type, discount_value, start_date, end_date
- business_id FK, logo_url, conditions, is_active
- `is_deal_of_day` BOOLEAN, `deal_of_day_date` DATE — manual flag
- `booking_type` (inherit/phone/whatsapp/url), booking_phone, booking_whatsapp, booking_url, booking_instructions
- `max_reveals` INTEGER — limit code reveals (NULL = unlimited)
- **NO `created_at` column** — use `o.id DESC` for ordering

**reviews** — id, business_id, user_id, rating (1-5), comment, first_name, last_name, response_text, response_date, created_at

**promo_codes** — offer_id, code, is_active (migration 021, 1:N per offer)

**code_reveals** — user_id, offer_id, promo_code_id, revealed_at (migration 020)

### Junction Tables
- **user_businesses** — user_id, business_id (business ownership, NOT `owner_id` on businesses)
- **favorite_offers** — user_id, offer_id
- **followed_businesses** — user_id, business_id (NOT `subscriptions`)
- **user_badges** — user_id, badge_id, earned_at (UNIQUE constraint)

### Analytics Tables
- **business_clicks** — business_id, offer_id (nullable), action_type, created_at (migration 022, anonymous GDPR)
- **business_views** — business_id, viewed_at (page visits to /business/:id)
- **offer_views** — offer_id, viewed_at (page visits to /oferta/:id)

### Auth Tables
- **refresh_tokens** — user_id, token, expires_at, revoked_at
- **password_reset_tokens** — email, code, expires_at, used

### Gamification Tables
- **badge_definitions** — slug, name, description, icon, color, category, sort_order (10 badges)
- **user_badges** — user_id, badge_id, earned_at
- **user_login_streaks** — user_id, last_login_date, current_streak, longest_streak
- **user_points** — user_id, total_points
- **points_history** — user_id, amount, reason, created_at

### Other Tables
- **push_tokens** — user_id, token, token_type ('expo'/'fcm'), platform, device_name
- **business_requests** — user_id, name, category_id, city_id, address, phone, website, description, ai_score, ai_flags, ai_reasoning, status (pending/approved/rejected)
- **offer_requests** — "Pinch" feature (request offers from businesses)
- **business_images** — business_id, image_url (Cloudinary), image_filename (legacy), sort_order
- **business_locations** — business_id, address, lat, lng, phone, city_id, booking fields
- **audit_log** — action, entity_type, entity_id, user_id, ip_address, details (JSONB)
- **cities** — id, name
- **categories** — id, name, icon

### Migrations (006-064)
Latest: `064_audit12_indexes.sql`. Gap at 030 (skipped). All run on production.
Key migrations: 016 (GDPR), 021 (promo_codes), 022 (click_tracking), 024 (preferred_city_ids[]), 025 (Google OAuth), 026 (verified badge), 027 (badges), 028 (analytics tables), 029 (FK CASCADE), 032 (missing_schema), 033 (subscription_plans), 034 (business_subscriptions), 035 (subscription_history), 036 (subscription_badge_type), 037 (business_push_log), 038 (competitor_blocking), 039 (subscription_indexes), 040 (deal_nominations).

**Migrations 041-054:**
041 (missing_tables), 042 (update_tier_values), 043 (badge_definitions_and_user_badges), 044 (business_locations_maps_url), 045 (premium_gallery_64), 046 (schema_from_legacy), 047 (missing_indexes), 048 (reports), 049 (offer_moderation), 050 (offer_rejection_reason), 051 (free_plan_booking), 052 (business_hours), 053 (business_catalog), 054 (onboarding_requests).

**Migrations 055-064:**
055 (premium_gallery_unlimited), 056 (ai_suggested_responses), 057 (audit10_schema_fixes), 058 (category_rankings + flash_deals), 059 (notification_preferences), 060 (saved_searches), 061 (collections), 062 (stripe_price_ids), 063 (referral_system), 064 (audit12_indexes).

### New Tables (since migration 041)
- **reports** — user_id, entity_type (offer/business/review), entity_id, reason, details, status, admin_notes, created_at
- **business_hours** — business_id, location_id, day_of_week (0=Mon, 6=Sun), open_time, close_time, is_closed
- **business_catalog_categories** — business_id, name, sort_order
- **business_catalog_items** — category_id, name, description, price, sort_order
- **onboarding_requests** — business_id, user_id, status, notes, file_urls (JSONB), admin_notes
- **flash_deals** — offer flash_expires_at column (on offers table)
- **notification_preferences** — user_id, category, daily/flash/weekly/marketing toggles
- **saved_searches** — user_id, query, filters (JSONB), alert_enabled
- **collections** — id, name, description, image_url, curated editorial lists
- **collection_offers** — collection_id, offer_id junction
- **referral_codes** — referral_code on users table, referral tracking

**WARNING:** Two migration directories exist — `appredueri_backend/migrations/` (legacy, orphaned) and `appredueri_backend/src/migrations/` (current). Only use `src/migrations/`.

---

## 4. AUTH SYSTEM

### Web Auth (Cookie-based — site-ul EJS)
- **Middleware:** `webAuth.js` → `optionalWebAuth` / `requireWebAuth`
- **Access token:** Cookie `ofai_token` (HttpOnly, Secure in prod, SameSite=lax, 24h)
- **Refresh token:** Cookie `ofai_refresh_token` (30d, same flags)
- **Auto-refresh:** Transparent in middleware — if access expired, tries refresh rotation
- **Login/Register:** Sets both cookies → redirect
- **Logout:** Revokes refresh in DB, clears both cookies

### Mobile Auth (Bearer token — Flutter app)
- **Middleware:** `auth.js` → `authenticateToken` / `optionalAuth`
- **Access token:** `Authorization: Bearer <jwt>` header (24h)
- **Refresh token:** 30d, DB-backed (`refresh_tokens` table), rotation on refresh
- **Auto-refresh:** `api_client.dart` Dio interceptor, deduplicates concurrent 401s via Completer
- **Storage:** `FlutterSecureStorage` (Android EncryptedSharedPreferences)

### Business Portal Auth
- **Middleware:** `businessWebAuth.js` → Cookie auth + `user_businesses` ownership check
- **Admin bypass:** Admins access any business

### Admin Auth
- **Middleware:** `adminAuth.js` → HTTP Basic Auth
- **Rate limit:** 60 req/min

### Google OAuth
- **Web:** Google Identity Services (One Tap) on login.ejs + register.ejs
- **Mobile:** `google_sign_in` Flutter package → sends `idToken` to backend
- **Backend:** `POST /auth/google` → verify with `OAuth2Client` → find-or-create user
- **Account linking:** Existing email users get `google_id` + `profile_picture_url` added
- **New users:** `password_hash = NULL`, auto-redirect to `/onboarding`
- **Env var:** `GOOGLE_CLIENT_ID`

### CSRF Protection
- **Package:** `csrf-csrf` (double-submit cookie pattern)
- **Cookie:** `__csrf` (HttpOnly, Secure in prod, SameSite=lax)
- **Meta tag:** `<meta name="csrf-token">` in head.ejs
- **Forms:** Hidden `_csrf` field
- **AJAX:** `X-CSRF-Token` header via `getCsrfToken()` helper in main.js
- **Skipped:** Mobile API (Bearer auth + `X-Client: mobile` header), `/auth/google`, safe methods
- **IMPORTANT:** Mobile app sends `X-Client: mobile` on ALL requests (incl. login/register which lack Bearer token). Auth endpoints are explicitly exempted. `/api/web/clicks` now requires CSRF (anonymous users get `_csrf_session` cookie on first page load)
- **Click tracking:** CSRF re-enabled on `/api/web/clicks` — frontend sends X-CSRF-Token header (footer.ejs)

---

## 5. API ENDPOINTS

### Auth (`/auth/*`)
| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | /auth/register | None | Email/password registration |
| POST | /auth/login | None | Email/password login |
| POST | /auth/google | None | Google OAuth (verify ID token) |
| POST | /auth/refresh | Refresh token | Token rotation |
| POST | /auth/forgot-password | None | Send 6-digit reset code |
| POST | /auth/verify-reset-code | None | Validate reset code |
| POST | /auth/reset-password | None | Set new password |
| POST | /auth/logout | Bearer | Revoke refresh token |

### Users (`/users/*`)
| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | /users/me | Bearer | Profile + badges + points + preferences |
| PUT | /users/me | Bearer | Update name (30-day cooldown, COALESCE), show_picture_in_reviews |
| POST | /users/me/profile-picture | Bearer | Upload to Cloudinary (300x300) |
| DELETE | /users/me/profile-picture | Bearer | Delete from Cloudinary |
| PUT | /users/me/password | Bearer | Change password |
| DELETE | /users/me | Bearer | Full GDPR account deletion |
| GET | /users/me/data-export | Bearer | GDPR data export (JSON) |
| GET | /users/me/gamification | Bearer | Points, level, streaks |

### Offers (`/offers/*`)
| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | /offers | optionalAuth | List (filters: city_id, category_id, q, sort, prefs) |
| GET | /offers/:id | optionalAuth | Detail with business, reviews, promo codes |
| GET | /offers/feed | Bearer | Personalized feed (preferences-based) |
| GET | /offers/deal-of-day | None | Featured offer (manual flag → fallback) |
| GET | /offers/:id/similar | None | Similar offers by category |
| GET | /offers/:id/promo-codes/reveal | Bearer | Reveal next promo code |
| POST | /offers | Admin | Create offer |
| PUT | /offers/:id | Admin | Update offer |
| DELETE | /offers/:id | Admin | Soft delete (is_active=false) |

### Businesses (`/businesses/*`)
| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | /businesses | optionalAuth | List (filters: city_id, category_id, q, prefs) |
| GET | /businesses/:id | optionalAuth | Detail with offers, reviews, gallery |
| GET | /businesses/suggest | None | Autocomplete search (rate limited) |

### Reviews, Favorites, Subscriptions
| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | /reviews/business/:id | None | Business reviews (paginated) |
| POST | /reviews | Bearer | Create review |
| DELETE | /reviews/:id | Bearer | Delete own review |
| GET | /favorites | Bearer | User's favorite offers |
| POST | /favorites/:offerId | Bearer | Add favorite |
| DELETE | /favorites/:offerId | Bearer | Remove favorite |
| GET | /subscriptions | Bearer | Followed businesses |
| POST | /subscriptions/:businessId | Bearer | Follow |
| DELETE | /subscriptions/:businessId | Bearer | Unfollow |

### Web AJAX (`/api/web/*` — cookie auth)
| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | /api/web/clicks | None | Anonymous click tracking (fire-and-forget) |
| PUT | /api/web/preferences | Cookie | Save city/category preferences |
| POST | /api/web/account/profile-picture | Cookie | Upload profile picture |
| DELETE | /api/web/account/profile-picture | Cookie | Delete profile picture |
| DELETE | /api/web/reviews/:id | Cookie | Delete own review (ownership check via `req.webUser.id`) |
| GET | /api/web/portal/:bid/analytics/views | Business owner | Page view stats |
| GET | /api/web/portal/:bid/analytics/offer-views | Business owner | Per-offer view stats |
| GET | /api/web/portal/:bid/analytics/subscribers | Business owner | Subscriber growth |
| GET | /api/web/portal/:bid/analytics/clicks | Business owner | Click breakdown |

### Click Action Types (GDPR-anonymous)
`phone`, `whatsapp`, `booking_url`, `website`, `navigate`, `share`, `follow`, `unfollow`, `gallery`, `copy_code`, `favorite`, `unfavorite`

---

## 6. FLUTTER APP ARCHITECTURE

### Package: `ro.ofai.ofai_flutter`

**Key Dependencies:**
```yaml
flutter_riverpod: ^2.6.1    # State management (StateNotifier + FutureProvider)
go_router: ^14.8.1           # Navigation (ShellRoute bottom nav)
dio: ^5.7.0                  # HTTP client (auth interceptor, auto-refresh)
flutter_secure_storage: ^9.2.4
cached_network_image: ^3.4.1
google_fonts: ^6.2.1         # DM Serif Display + Inter
geolocator: ^13.0.2
firebase_core: ^3.8.1
firebase_messaging: ^15.2.1
google_sign_in: ^6.2.1
image_picker: ^1.1.2
share_plus: ^10.1.4
```

### Navigation (GoRouter)
```
ShellRoute (bottom nav: Acasă, Explorează, Colecția mea, Cont)
├── /                    HomeScreen
├── /explore             ExploreScreen
├── /collection          CollectionScreen
└── /account             AccountScreen

Standalone routes:
├── /offer/:id           OfferDetailScreen (slide-up transition)
├── /business/:id        BusinessDetailScreen (slide-up)
├── /login               LoginScreen (fade)
├── /register            RegisterScreen (fade)
├── /forgot-password     ForgotPasswordScreen
├── /verify-code         VerifyCodeScreen
├── /reset-password      ResetPasswordScreen
├── /onboarding          OnboardingScreen
├── /account/edit-profile, /preferences, /change-password, /data-export, /delete-account
├── /account/saved-searches, /account/my-reports
├── /categories, /cities, /business-request
├── /collection/:id        CollectionDetailScreen
└── /terms, /privacy, /help
```

### Providers (Riverpod)
| Provider | Type | Purpose |
|----------|------|---------|
| authProvider | StateNotifier | Auth state, login/register/logout, Google OAuth, profile picture, updateShowPictureInReviews |
| offersListProvider | StateNotifier | Offers list with filters, pagination, preferences, total count |
| businessesListProvider | StateNotifier | Businesses list with filters, pagination, total count |
| favoritesProvider | StateNotifier | Favorite offers, optimistic toggle |
| subscriptionsProvider | StateNotifier | Followed businesses, optimistic toggle |
| gamificationProvider | StateNotifier.autoDispose | Points, level, streaks, badges |
| citiesProvider | FutureProvider | Cities list from API |
| categoriesProvider | FutureProvider | Categories list from API |
| onboardingDoneProvider | FutureProvider | SharedPreferences check |
| dealOfDayProvider | FutureProvider.autoDispose | Deal of the day offer |
| feedProvider | FutureProvider.autoDispose | Personalized offer feed |
| popularOffersProvider | FutureProvider | Popular offers (no auth) |
| offerRequestProvider(id) | StateNotifier.autoDispose.family | Pinch request count + submit per business |
| offersCountProvider | FutureProvider.autoDispose | Total active offers count (reads pagination.total) |
| collectionsProvider | FutureProvider | Curated collections list |
| savedSearchesProvider | StateNotifier | Saved searches with alerts |
| searchHistoryProvider | StateNotifier | Persistent local search history |
| notificationPreferencesProvider | StateNotifier | Per-category notification toggles |
| reportsProvider | StateNotifier | User reports list + create |
| recentlyViewedProvider | StateNotifier | Recently viewed offers (SharedPreferences) |
| categoryFeedProvider | FutureProvider | Category-based trending offers feed |
| connectivityProvider | StreamProvider | Online/offline status (connectivity_plus) |

### Models
- **User** — id, email, firstName, lastName, role, preferredCityIds[], badges[], points, profilePictureUrl, hasPassword
- **Offer** — id, title, description, discountType/Value, endDate, imageUrl, business (OfferBusiness), booking, gallery[], hasPromoCode, saveCount, isTrending
- **Business** — id, name, address, lat, lng, logoUrl, coverImage, city, category, rating, ratingCount, isVerified, followerCount, reviewSummary, ratingDistribution
- **Review** — id, rating, comment, firstName, lastName, response, profilePictureUrl, userId (for own-review detection + delete)
- **PaginatedResponse<T>** — data[], pagination (page, limit, total, totalPages, hasMore)
- **Collection** — id, name, description, imageUrl, offers list
- **Report** — id, offerId/businessId, category, description, status, createdAt
- **SavedSearch** — id, query, filters, alertEnabled, createdAt
- **CategoryFeed** — categoryId, categoryName, trendingOffers list
- **Catalog** — id, businessId, categories list, items with prices

### Services
- **PushNotificationService** — Singleton, FCM init, token registration, deep link handling
- **AnalyticsService** — Fire-and-forget click tracking to `/offers/clicks`
- **ErrorHandler** — DioException → user-friendly Romanian messages, SnackBar display

### Android Config
- Min SDK: API 21+, Java 17
- Deep linking: `https://ofai.ro/**` (autoVerify)
- Permissions: FINE_LOCATION, COARSE_LOCATION, POST_NOTIFICATIONS
- Release signing: `key.properties` → `ofai-release.keystore` (both gitignored)

### Flutter Gotchas
- **Card `clipBehavior: Clip.hardEdge`** — NOT antiAlias; avoids sub-pixel rendering artifacts on some GPUs
- **Horizontal OfferCard container: `height: 288`** — card content max ~286px (image 150 + padding 12+16 + divider/metadata ~108). Both home_screen and offer_detail_screen use this height
- **Countdown pill: urgency > 0 gate** — only shown when ≤7 days remaining (matches web `initCountdowns()` behavior). Urgency 0 = >7d (hidden), 1 = 3-7d (yellow), 2 = <3d (red), 3 = <24h (red bold)
- **`Formatters.timeLeft()` / `urgencyLevel()`** — in `core/utils/formatters.dart`, shared by OfferCard + FeaturedOfferCard + OfferDetailScreen

---

## 7. WEB TEMPLATES (EJS)

### Public Pages
| Template | Route | Description |
|----------|-------|-------------|
| home.ejs | / | Landing page (deal of day, featured offers, categories, top businesses) |
| oferte.ejs | /oferte | Offers listing (48/page, sort pills, category/city filters, preferences pill) |
| offer-detail.ejs | /oferta/:id | Offer detail (reviews, gallery, promo reveal, countdown, booking actions) |
| business-detail.ejs | /business/:id | Business profile (offers, reviews, gallery, verified badge, follow) |
| business-uri.ejs | /business-uri | Business listing (filters, preferences pill) |
| login.ejs | /login | Email/password + Google One Tap |
| register.ejs | /register | Form + Google + GDPR checkbox |
| account.ejs | /cont | Profile, badges grid, profile picture upload |
| colectia-mea.ejs | /colectia-mea | Favorites + followed businesses |
| setari.ejs | /setari | Password change, settings, GDPR export, account deletion |
| preferinte.ejs | /preferinte | City/category preference selector |
| onboarding.ejs | /onboarding | First-time preferences |
| categorii.ejs, orase.ejs | /categorii, /orase | Taxonomy pages |
| termeni.ejs, confidentialitate.ejs, ajutor.ejs | Legal | Static legal pages |
| pentru-business.ejs | /pentru-business | Business signup form + AI validation |

### Portal Pages (Business Dashboard)
| Template | Route | Description |
|----------|-------|-------------|
| dashboard.ejs | /my-businesses | List owned businesses |
| manage.ejs | /my-businesses/:id | 7 tabs (Info/Oferte/Catalog/Recenzii/Statistici/Suport/Abonament), Chart.js v4, ~2250 lines, split into 7 partials |
| offer-form.ejs | .../offers/new | Create/edit offer form |

### Admin Pages (Basic Auth)
- businesses-list/edit/new, offers-list/edit/new, users-list/edit, reviews-list, business-requests, categories, cities, review-summaries, dashboard

### Design System (main.css → 7 section files + portal.css + admin.css + onboarding.css)
- **Theme:** Dark mode only — bg `#06060a`, accent `#fb923c`
- **Fonts:** DM Serif Display (headings, NO fontWeight), Inter (body)
- **Card radius:** 16px, pill radius: 100px
- **Glassmorphic navbar:** backdrop-filter blur
- **Particle canvas:** Generic `setupParticleCanvas()` on hero + auth pages
- **TiltFx:** 3D perspective hover on offer cards

### Client JS (main.js ~660 lines)
- `initCountdowns()` — Countdown timers (≤7 days only, urgency colors, 60s interval)
- `toggleFavorite()` / `toggleFollow()` — AJAX with optimistic update
- `trackClick()` — Fire-and-forget click analytics
- `getCsrfToken()` — Read from meta tag for AJAX
- `initGeolocation()` — GPS + Haversine distance on cards
- `initSearchAutosuggest()` — Debounced 300ms typeahead
- Toast notifications, FAQ accordion, star rating, share, returnTo flow

---

## 8. CRON JOBS (node-cron, in-process)

| Schedule | Job | Retention |
|----------|-----|-----------|
| Daily 03:00 | Clean refresh_tokens | 60 days |
| Daily 03:15 | Clean push_notifications_log | 90 days |
| Daily 03:30 | Clean password_reset_tokens | 7 days |
| Daily 03:45 | **Deactivate expired offers** (is_active=false where end_date < TODAY) | — |
| Sunday 04:00 | Clean audit_log | 365 days |
| 1st monthly 04:30 | Clean business_clicks | 180 days |

---

## 9. ENVIRONMENT VARIABLES (Railway)

```
# Required
DATABASE_URL=postgresql://...     # Full connection string (SSL)
JWT_SECRET=...                    # >32 chars, FATAL if missing in prod
NODE_ENV=production
PORT=4000

# Auth
GOOGLE_CLIENT_ID=...              # Google OAuth client ID
CSRF_SECRET=...                   # Falls back to JWT_SECRET if missing
ADMIN_USER=...                    # Basic Auth for admin panel
ADMIN_PASSWORD=...

# Services
CLOUDINARY_CLOUD_NAME=dtlawgplb
CLOUDINARY_API_KEY=REDACTED
CLOUDINARY_API_SECRET=...
RESEND_API_KEY=re_...             # Email delivery
FROM_EMAIL=OFAI <noreply@ofai.ro>
FIREBASE_ADMINSDK_JSON=...        # ENTIRE JSON file content (not just key!)
SENTRY_DSN=REDACTED
ANTHROPIC_API_KEY=sk-ant-...      # Claude Haiku for summaries
N8N_WEBHOOK_URL=https://n8n-...
STRIPE_SECRET_KEY=sk_...          # Stripe payment processing
STRIPE_WEBHOOK_SECRET=whsec_...   # Stripe webhook signature verification
TIER_GATING_ENABLED=true          # Enable/disable subscription tier gating
```

---

## 10. KEY PATTERNS & GOTCHAS

### Database
1. **offers has NO `created_at`** — always use `o.id DESC` for newest ordering
2. **Business ownership** → query `user_businesses` junction table (NOT `owner_id`, NOT `business_users`)
3. **offer_views vs business_views** — separate tables, separate analytics dropdowns
4. **preferred_city_id (old single) vs preferred_city_ids (new array)** — code uses array only, old column kept for compat
5. **Google users have `password_hash = NULL`** — cannot use change-password flow, check before showing form

### Auth & Security
6. **3 separate auth systems:** Web cookies, Mobile Bearer, Admin Basic — don't mix them
7. **CSRF required on ALL web POST** — X-CSRF-Token header or _csrf body field; mobile Bearer exempt
8. **`optionalAuth` middleware** — attaches `req.user` if valid token, sets `null` otherwise (never rejects)
9. **Cookie before redirect** — always set cookies BEFORE redirect, clear both on deny
10. **`requireWebAuth` returns 401 JSON for `/api/*` routes** — not HTML redirect (prevents fetch() following 302)

### Backend
11. **Duplicate offer creation** — exists in BOTH `web.js` AND `business-portal.js`, changes must apply to both
12. **web.js split into 4 sub-routers** — web.js (~2050), web-auth.js, web-account-api.js, web-portal-api.js (~2100). Total ~5100 lines across 4 files + web-shared.js utility
13. **manage.ejs var hoisting bug** — `currentViewsMode`, `currentClicksAction` MUST be declared at TOP of IIFE, before hash restore
14. **Helmet.js CORP disabled** — `crossOriginResourcePolicy: false` required for external images (Cloudinary, DiceBear)
15. **`FIREBASE_ADMINSDK_JSON`** — must be the ENTIRE JSON file content, not just the private key

### Flutter
16. **FutureProvider must use `.autoDispose`** to avoid memory leaks on detail screens
17. **`setState` must check `mounted`** before executing in async callbacks
18. **`ref.invalidate()` before navigation** after SharedPreferences write (cached values)
19. **Firebase background handler** must be top-level function (not method)
20. **Card `Clip.hardEdge` not `antiAlias`** — avoids sub-pixel bleed on some GPUs (Samsung A33 tested)
21. **Horizontal OfferCard `height: 288`** — card needs ~286px max (image 150 + content); used in home_screen + offer_detail_screen
22. **Countdown urgency > 0 gate** — `_buildCountdown()` returns `SizedBox.shrink()` for >7 days offers
23. **CSRF + mobile auth** — login/register have no Bearer token; `X-Client: mobile` header skips CSRF
24. **`Business.category` is `IdName?` type** — use `b.categoryName` getter for String, NOT `b.category?.toLowerCase()`
25. **`_MarqueeLogos` widget must be isolated** — separate StatefulWidget with own AnimationController. NEVER put setState at 60fps inside HomeScreen
26. **`PUT /users/me` COALESCE pattern** — `COALESCE($1, first_name)` prevents NULL overwrite on partial updates (e.g. sending only `show_picture_in_reviews`)
27. **Name change 30-day cooldown** — conditional guard only when `first_name`/`last_name` change, NOT on `show_picture_in_reviews` toggle. Returns 429 with `daysLeft`
28. **API base:** `https://ofai.ro` (prod), `http://10.0.2.2:4000` (emulator dev)
29. **Distance sort is client-side only** — sorts loaded items via `DistanceUtils.haversine()`. Offers/businesses without coords (`lat`/`lng` null) are pushed to end of list. Limited to items in memory (not full server dataset)
30. **Offer interleaving per-page** — `_interleaveOffers()` applied per-page only (`fetch()` page 1, `loadMore()` new items only), never re-interleaves full accumulated list (prevents visual jumps)
31. **`review_responses` ON DELETE CASCADE** — deleting a review (migration 029 FK) auto-deletes business responses. Intentional but user sees no warning about losing business response

### Deployment
21. **Railway auto-deploys** on `git push origin main` (~1-2 min)
22. **Migrations must be run separately** — not auto-applied
23. **DiceBear logos** — `https://api.dicebear.com/7.x/initials/png?seed=NAME` (CDN-cached)
24. **Countdown visible only when ≤7 days** — CSS `display:none` default, JS sets `display:block`

---

## 11. FEATURES — CURRENT STATUS

### ✅ Complete & Production-Ready
- Full EJS website (20+ pages) with dark theme, glassmorphic UI
- Flutter Android app (v15+) — all screens, auth, push, analytics
- Cookie + Bearer + Google OAuth auth systems
- Business portal with analytics dashboard (Chart.js)
- Push notifications (dual FCM + Expo)
- Gamification (10 badges, points, streaks, levels)
- GDPR compliance (consent, data export, account deletion, anonymous tracking)
- CSRF protection (double-submit cookie)
- SEO (sitemap, robots.txt, JSON-LD, OG tags, canonical URLs)
- Rate limiting (9 limiters)
- Verified business badges
- Profile pictures (Cloudinary, visibility toggle)
- Preferences filter pill ("Preferințele mele" on /oferte + /business-uri)
- Click tracking (12 action types, anonymous)
- Countdown timers (≤7 days, 4-level urgency colors, auto-hide)
- Auto-deactivation of expired offers (cron job)
- Promo code reveal (multi-codes per offer)
- Deal of the Day (manual flag + fallback query)
- Sort "Expiră curând" on /oferte (48 offers per page)
- CSRF mobile skip via `X-Client: mobile` header (24 Feb)
- Flutter: exact offers count on home screen (`offersCountProvider` reads `pagination.total`)
- Flutter: countdown pill ≤7 days gate (urgency > 0 only, matches web)
- Flutter: `Clip.hardEdge` on offer/business/featured cards (eliminates sub-pixel artifacts)
- Flutter: horizontal card container `height: 300` (home + offer detail similar offers)

**Mobile Parity Sprint (24 Feb) — 9 features:**
- Backend: streak fix in mobile auth.js (fire-and-forget `updateStreak()`, parity with webAuth.js)
- Backend: COALESCE fix on `PUT /users/me` (prevents NULL overwrite on partial updates)
- Backend: 30-day name change cooldown guard (conditional — only when name fields change, returns 429)
- Flutter: active offers navigable on business detail (InkWell → `/offer/:id`)
- Flutter: toggle `show_picture_in_reviews` on account screen (SwitchListTile + `updateShowPictureInReviews`)
- Flutter: name change cooldown warning on edit profile (catch 429, show backend message)
- Flutter: results count on Explore ("Afișând X din Y oferte/business-uri", reads `pagination.total`)
- Flutter: search + sort on Collection screen (TextField + sort chips: Nume A-Z, Rating, client-side filter)
- Flutter: "Cum să folosești oferta" card on offer detail (booking-type-aware tip text)
- Flutter: marquee partner logos on home screen (`_MarqueeLogos` isolated widget, `AnimationController.repeat()`)

**Mobile Parity Sprint v2 (24 Feb) — 8 features:**
- Backend: `DELETE /reviews/:id` (mobile Bearer auth, ownership check `review.user_id === req.user.id`, CASCADE deletes review_responses)
- Backend: `DELETE /api/web/reviews/:id` (web cookie auth, ownership check via `req.webUser.id`)
- Backend: `user_id` field added to GET `/reviews/business/:id` response (for own-review detection)
- Flutter: Review delete (ReviewCard delete icon visible only when `review.userId == currentUserId`, confirmation dialog, optimistic removal)
- Flutter: Pinch card on expired offer detail (`_OfferDetailPinchCard` — shows when `!offer.isActive`, reuses `offerRequestProvider`, auto-follows business on success)
- Flutter: Animated stat counters on home screen (`_AnimatedStatPill` — counts 0→target over 1500ms, easeOut curve, `_hasAnimated` flag prevents re-animation)
- Flutter: Offer interleaving in providers (`_interleaveOffers()` — round-robin by business, applied per-page in `fetch()`/`loadMore()` to avoid visual jumps)
- Flutter: Geolocation banner on Explore screen (visible when location denied + not dismissed, CTA requests permission, `deniedForever` → settings, `AnimatedSize` smooth show/hide)
- Flutter: Distance sort on Explore screen ("Distanță" in sort picker, Haversine sort, null-coords pushed to end)
- Flutter: Distance sort on Collection screen (both Favorites + Subscriptions tabs, same Haversine pattern)
- Flutter: Per-location booking chips on business detail (shown only when location booking differs from main business booking, dedup logic via `_hasLocationBooking()`)

### ✅ Recently Completed (Mar 2026)
- **Location Management:** Multi-location support, Google Maps URL parsing (migration 044)
- **Opening Hours:** Per-location schedules, 24h select dropdowns, consumer Deschis/Închis badge (migration 052)
- **Unified Catalog:** Categories + items CRUD, CSV import (2-step: upload→preview→confirm), consumer display with category tabs (migration 053)
- **Concierge Onboarding:** Standard+ tier only, request form + file upload, admin queue at /admin/onboarding (migration 054)
- **Report System:** User reports with categories (offer/business/review), admin review queue, auto-flag (≥3→email admin, ≥10→deactivate) (migration 048)
- **AI Offer Moderation:** Automatic offer validation via Claude API, rejection reasons (migrations 049-050)
- **AI Business Validation:** Two-pass pipeline for business signup requests (services/llm/)
- **Review Summarization:** AI-powered review summary generation + suggested replies
- **Flash Deals:** flash_expires_at on offers, countdown badge widget, Home section (migration 058)
- **Notification Preferences:** Granular per-category toggles (migration 059)
- **Saved Searches:** Save query+filters, alert on new matches, Flutter screen + provider (migration 060)
- **Collections:** Curated editorial lists, admin CRUD, Flutter detail screen (migration 061)
- **Billing/Stripe:** PRODUCTION READY — full subscription lifecycle with webhooks (migration 062)
- **Referral System:** referral_code on users, /r/:code web redirect, Flutter "Invită prieteni" (migration 063)
- **Category Feed:** Cron + API + Flutter home section
- **Social Proof Badges:** "Nou", "Se termina curand", trending badges on offer cards
- **Recently Viewed:** Local storage of last viewed offers/businesses
- **Search History:** Persistent local search history on Explore
- **Search Bar Overhaul:** Better results, highlights, keyboard nav, a11y
- **Lenis Smooth Scroll:** CDN-loaded, graceful fallback
- **Offline Indicator:** connectivity_plus StreamProvider + red banner
- **Rich Share:** OG tags + Flutter Share.shareUri()
- **Deep Links:** apple-app-site-association + assetlinks.json, AndroidManifest intent filters
- **CSP Nonce Migration:** Helmet CSP with per-request nonce for inline scripts
- **OFAI Wordmark Logo:** + Play Store build config
- **web.js Split:** Refactored into 4 sub-routers for maintainability
- **main.css Split:** Refactored into 7 section files + import loader
- **manage.ejs Split:** 7 tab partials extracted from monolithic file
- **Audits #9-#12:** 155+ total fixes applied (v0.9.0 → v0.12.0)
- **Premium Gallery:** Increased limit from 32→64 images for premium tier (migration 045)
- **Refresh Token Security:** Race condition fixed with `SELECT ... FOR UPDATE` transaction

### ❌ TODO
- **iOS build:** Requires macOS (not tested on Windows dev machine)
- **Play Store publication:** Signing done, store listing not submitted
- **Stripe go-live:** Switch from test keys to live Stripe keys
- **Redis cache layer:** Planned (see docs/plans/2026-03-23-redis-cache-plan.md), not yet implemented
- **Rate limiter persistence:** Currently in-memory, resets on deploy (Redis plan will address this)
- **n8n WF3-6:** Daily digest, review reminder, welcome series, admin alerts
- **Migrations 001-005:** Missing from repo (need pg_dump from production)
- **Exact GPS coordinates:** Business locations use estimated coords
- **Drop `preferred_city_id` column** after full verification
- **Gamification UI:** Backend tracks points/levels/streaks but UI is hidden (badges only visible)

### ⚠️ Known Issues

**RESOLVED (Audit #8+#9):**
- ~~Gallery image race condition~~ → FIXED: transaction + FOR UPDATE row lock (business-portal.js)
- ~~Feed endpoint format mismatch~~ → FIXED: returns PaginatedResponse format (offers.js)
- ~~Gamification point manipulation~~ → FIXED: 24h cooldown on toggle actions (gamification.js)
- ~~X-Client CSRF bypass~~ → FIXED: restricted to auth endpoints only (index.js)
- ~~showToast innerHTML XSS~~ → FIXED: uses textContent for user messages (main.js)
- ~~Banned users mobile access~~ → FIXED: banned_at check in auth.js middleware
- ~~Open redirect via returnTo~~ → FIXED: validated to relative paths only (web-auth.js)
- ~~4 missing CREATE TABLE migrations~~ → FIXED: migration 041 creates all 4 tables
- ~~Hardcoded Google Client ID + n8n URL~~ → FIXED: moved to env vars
- ~~Tier fail-open~~ → FIXED: fails closed (503) when TIER_GATING_ENABLED=true (tierAuth.js)

**STILL OPEN:**
- Rate limiter persistence (in-memory, resets on deploy — Redis cache plan will address this)
- Firebase API keys in git history (keys rotated, history not cleaned)
- Review delete doesn't reverse gamification points
- Streak timezone (UTC vs Romania UTC+2/3)
- Migrations 001-005 missing from repo
- Gamification UI hidden (backend active, UI disabled)

---

## 12. ESSENTIAL COMMANDS

```bash
# Backend
cd appredueri_backend
npm run dev                        # Start dev server (nodemon, port 4000)
npm start                          # Production start
npm run seed:businesses            # Seed test data
node scripts/run-migration-production.js  # Run migration on prod DB

# Flutter
cd ofai_flutter
flutter run                        # Run on connected emulator
flutter build apk --debug          # Debug APK (~60MB)
flutter build apk --release        # Release APK (signed)
flutter analyze --no-pub           # Static analysis
flutter test --no-pub              # Run tests

# Deploy
git push origin main               # Auto-deploys to Railway (~1-2 min)

# Database (production)
node -e "const {Pool}=require('pg'); const p=new Pool({connectionString:'postgresql://postgres:REDACTED@REDACTED_DB_HOST/railway',ssl:{rejectUnauthorized:false}}); p.query('SELECT ...').then(r=>console.log(r.rows)).finally(()=>p.end())"

cd appredueri_backend
```

---

## 13. CATEGORY ICONS (15 categorii)

Clinica, Frizerie, Beauty, Auto, Restaurant, Cafenea, Fitness, Spa & Wellness, Optica, Farmacie, Veterinar, Stomatologie, Florarie, Curatatorie, Foto & Video

---

## 14. BADGE DEFINITIONS (10 badges)

| Slug | Trigger | Points |
|------|---------|--------|
| early_adopter | Registration (first N users) | — |
| first_review | First review written | 5 |
| reviewer_bronze | 5+ reviews | 5 |
| reviewer_silver | 15+ reviews | 5 |
| reviewer_gold | 50+ reviews | 5 |
| first_favorite | First offer favorited | 2 |
| social_butterfly | Follow 5+ businesses | 2 |
| loyal_fan | Follow 10+ businesses | 2 |
| code_hunter | Reveal 5+ promo codes | 3 |
| explorer | View 20+ offer details | — |

---

## 15. RATE LIMITERS

| Limiter | Window | Max | Used By |
|---------|--------|-----|---------|
| generalLimiter | 1 min | 100 | Global middleware |
| authLimiter | 15 min | 10 | Login, register |
| passwordResetLimiter | 1 hour | 3 | Forgot password |
| verifyResetCodeLimiter | 15 min | 5 | Verify reset code |
| adminLimiter | 1 min | 60 | Admin routes |
| createContentLimiter | 1 hour | 20 | Reviews, etc. |
| clickLimiter | 1 min | 100 | Click tracking |
| searchLimiter | 1 min | 30 | Autocomplete |
| revealLimiter | 1 min | 20 | Promo code reveals |

All in-memory (reset on deploy). Persistence needs Redis/PG store.

---

## 16. AUDIT HISTORY (Summary)

| Audit | Date | Found | Fixed |
|-------|------|-------|-------|
| #1 | 16-17 Feb | Multiple | ALL FIXED |
| #2 | 18 Feb | Multiple | ALL FIXED |
| #3 | 18 Feb | 15 issues | ALL FIXED |
| #4 | 20 Feb | 113 issues (18C/60W/35S) | Mostly fixed (4 sprints) |
| #5 | 23 Feb | 20 issues (7C/8W/5S) | 14 fixed, 6 remaining |
| #6 (mobile) | 24 Feb | 5 issues | ALL FIXED |
| #7 (parity v2) | 24 Feb | 6 issues (0C/2W/4minor) | 2W fixed, 4 by-design |
| #8 (full) | 3 Mar | 171 issues (27C/44H/57M/43L) | Most critical fixed |
| #9 (full) | 6 Mar | 120 findings | 60+ fixed (v0.9.0) |

**Audit #10 (9 Mar):** Schema fixes, migration 057 (audit10_schema_fixes)
**Audit #11 (20 Mar):** 92 findings (16C/20H/26M/30L), 25 fixes — tier gating, Stripe fixes, XSS, LLM injection fencing
**Audit #12 (24 Mar):** 19 fixes — CSP nonce migration, performance indexes (migration 064)
**Post-audit (24 Mar):** CSRF re-enabled on click tracking, refresh token race condition fixed with FOR UPDATE

**Still unfixed from all audits:**
- Rate limiter persistence (needs Redis/PG store — planned in Redis cache layer)
- Firebase API keys in git history (keys rotated, history not cleaned)
- Migrations 001-005 missing (need pg_dump)
- Review delete doesn't reverse gamification points
- Streak timezone edge case (UTC vs Romania UTC+2/3)

**Resolved since Audit #8 (confirmed fixed):**
- ~~Gallery image race condition~~ → transaction + FOR UPDATE lock
- ~~Feed endpoint format mismatch~~ → returns PaginatedResponse
- ~~Gamification point dedup~~ → 24h cooldown
- ~~X-Client CSRF bypass~~ → restricted to auth endpoints
- ~~showToast innerHTML XSS~~ → textContent
- ~~4 missing CREATE TABLE migrations~~ → migration 041
- ~~Flutter auth check logs out offline~~ → network error handling
- ~~Hardcoded credentials~~ → env vars
- ~~Banned users mobile access~~ → banned_at check in auth middleware
- ~~Open redirect~~ → returnTo validated to relative paths
- ~~Tier fail-open~~ → fails closed in production
