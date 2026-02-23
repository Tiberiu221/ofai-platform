# OFAI — Project Context Document
## Ultima actualizare: 23 Februarie 2026

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
| Error Tracking | Sentry |
| Automation | n8n (on Railway) |
| Scraping | Playwright + OpenRouter (DeepSeek LLM enrichment) |

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
│   │   ├── routes/
│   │   │   ├── web.js            # ★ MAIN (~2900 lines) — all EJS pages + /api/web/* AJAX
│   │   │   ├── admin.js          # Admin panel (Basic Auth, CRUD all entities)
│   │   │   ├── business-portal.js # Business owner portal (cookie auth + ownership)
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
│   │   │   ├── cities.js         # Cities list
│   │   │   └── categories.js     # Categories with business count
│   │   ├── middleware/
│   │   │   ├── auth.js           # Bearer token (mobile API)
│   │   │   ├── webAuth.js        # Cookie JWT (web pages, auto-refresh)
│   │   │   ├── businessAuth.js   # Bearer + business ownership
│   │   │   ├── businessWebAuth.js # Cookie + business ownership
│   │   │   ├── adminAuth.js      # HTTP Basic Auth
│   │   │   └── rateLimiter.js    # 9 rate limiters (in-memory)
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
│   │   │   └── llm/              # Claude Haiku (review summaries, business validation)
│   │   ├── helpers/
│   │   │   ├── validate.js       # Input validation, pagination, password rules
│   │   │   └── jwt.js            # Token generation (24h access, 30d refresh)
│   │   ├── views/
│   │   │   ├── public/           # 20+ EJS pages (home, oferte, login, account, etc.)
│   │   │   │   ├── portal/       # Business portal (dashboard, manage ~1700 lines, offer-form)
│   │   │   │   └── partials/     # head.ejs, navbar.ejs, footer.ejs
│   │   │   └── admin/            # Admin panel (businesses, offers, users, reviews, requests)
│   │   ├── public/
│   │   │   ├── css/main.css      # Complete design system (~4000+ lines)
│   │   │   ├── js/main.js        # Client JS (~660 lines)
│   │   │   └── images/           # OG fallback SVG
│   │   └── migrations/           # SQL migrations 006-032
│   ├── scripts/
│   │   ├── scraping/             # 5-phase pipeline (01-scrape → 05-assign-images)
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
│   │   ├── models/               # Offer, Business, User, Review, City, Category, Pagination
│   │   ├── providers/            # Riverpod state (auth, offers, businesses, favorites, etc.)
│   │   ├── screens/              # 20+ screens organized by feature
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

### Migrations (006-032)
Latest: `032_missing_schema.sql`. Gap at 030 (skipped). All run on production.
Key migrations: 016 (GDPR), 021 (promo_codes), 022 (click_tracking), 024 (preferred_city_ids[]), 025 (Google OAuth), 026 (verified badge), 027 (badges), 028 (analytics tables), 029 (FK CASCADE).

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
- **Skipped:** Mobile API (Bearer auth), `/api/web/clicks`, `/auth/google`, safe methods

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
| PUT | /users/me | Bearer | Update name, show_picture_in_reviews |
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
├── /categories, /cities, /business-request
└── /terms, /privacy, /help
```

### Providers (Riverpod)
| Provider | Type | Purpose |
|----------|------|---------|
| authProvider | StateNotifier | Auth state, login/register/logout, Google OAuth, profile picture |
| offersListProvider | StateNotifier | Offers list with filters, pagination, preferences |
| businessesListProvider | StateNotifier | Businesses list with filters, pagination |
| favoritesProvider | StateNotifier | Favorite offers, optimistic toggle |
| subscriptionsProvider | StateNotifier | Followed businesses, optimistic toggle |
| gamificationProvider | StateNotifier.autoDispose | Points, level, streaks, badges |
| citiesProvider | FutureProvider | Cities list from API |
| categoriesProvider | FutureProvider | Categories list from API |
| onboardingDoneProvider | FutureProvider | SharedPreferences check |
| dealOfDayProvider | FutureProvider.autoDispose | Deal of the day offer |
| feedProvider | FutureProvider.autoDispose | Personalized offer feed |
| popularOffersProvider | FutureProvider | Popular offers (no auth) |

### Models
- **User** — id, email, firstName, lastName, role, preferredCityIds[], badges[], points, profilePictureUrl, hasPassword
- **Offer** — id, title, description, discountType/Value, endDate, imageUrl, business (OfferBusiness), booking, gallery[], hasPromoCode, saveCount, isTrending
- **Business** — id, name, address, lat, lng, logoUrl, coverImage, city, category, rating, ratingCount, isVerified, followerCount, reviewSummary, ratingDistribution
- **Review** — id, rating, comment, firstName, lastName, response, profilePictureUrl
- **PaginatedResponse<T>** — data[], pagination (page, limit, total, totalPages, hasMore)

### Services
- **PushNotificationService** — Singleton, FCM init, token registration, deep link handling
- **AnalyticsService** — Fire-and-forget click tracking to `/offers/clicks`
- **ErrorHandler** — DioException → user-friendly Romanian messages, SnackBar display

### Android Config
- Min SDK: API 21+, Java 17
- Deep linking: `https://ofai.ro/**` (autoVerify)
- Permissions: FINE_LOCATION, COARSE_LOCATION, POST_NOTIFICATIONS
- Release signing: `key.properties` → `ofai-release.keystore` (both gitignored)

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
| manage.ejs | /my-businesses/:id | 4 tabs (Info/Oferte/Recenzii/Statistici), Chart.js v4, ~1700 lines |
| offer-form.ejs | .../offers/new | Create/edit offer form |

### Admin Pages (Basic Auth)
- businesses-list/edit/new, offers-list/edit/new, users-list/edit, reviews-list, business-requests, categories, cities, review-summaries, dashboard

### Design System (main.css ~4000+ lines)
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
OPENROUTER_KEY=sk-or-...          # Scraping LLM enrichment
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
12. **web.js is ~2900 lines** — contains auth, pages, AJAX, GDPR, account, favorites, subscriptions, click tracking, analytics, promo codes
13. **manage.ejs var hoisting bug** — `currentViewsMode`, `currentClicksAction` MUST be declared at TOP of IIFE, before hash restore
14. **Helmet.js CORP disabled** — `crossOriginResourcePolicy: false` required for external images (Cloudinary, DiceBear)
15. **`FIREBASE_ADMINSDK_JSON`** — must be the ENTIRE JSON file content, not just the private key

### Flutter
16. **FutureProvider must use `.autoDispose`** to avoid memory leaks on detail screens
17. **`setState` must check `mounted`** before executing in async callbacks
18. **`ref.invalidate()` before navigation** after SharedPreferences write (cached values)
19. **Firebase background handler** must be top-level function (not method)
20. **API base:** `https://ofai.ro` (prod), `http://10.0.2.2:4000` (emulator dev)

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
- Scraping pipeline Phase 1-2 done (225 JSON files, 15 cities, LLM enrichment)

### ❌ TODO
- **Scraping Phase 3-5:** Verify, cleanup, image assignment
- **iOS build:** Requires macOS (not tested on Windows dev machine)
- **Play Store publication:** Signing done, store listing not submitted
- **Monetization:** Stripe + pricing tiers (49/99/199 RON/month)
- **n8n WF3-6:** Daily digest, review reminder, welcome series, admin alerts
- **Rate limiter persistence:** Currently in-memory, resets on deploy (needs Redis/PG store)
- **Migrations 001-005:** Missing from repo (need pg_dump from production)
- **Exact GPS coordinates:** Business locations use estimated coords
- **Drop `preferred_city_id` column** after full verification

### ⚠️ Known Issues
- Gallery image race condition (count-check not atomic — concurrent uploads can exceed 8)
- Firebase API keys in git history (keys rotated, but old commits still contain them)
- `offer_clicks` table referenced in deal-of-day fallback but actual table is `business_clicks`
- Feed endpoint returns plain array but Flutter expects `PaginatedResponse` format
- Gamification point manipulation (follow/unfollow toggling for infinite points, no dedup)
- Streak timezone (UTC vs Romania UTC+2/3 can break streaks at 11 PM local)

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

# Scraping
cd appredueri_backend
npm run scrape                     # Phase 1: Playwright → Google Maps → JSON
npm run scrape:enrich              # Phase 2: LLM enrichment → DB insert
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

**Still unfixed from all audits:**
- Rate limiter persistence (needs Redis/PG store)
- Firebase API keys in git history (keys rotated, history not cleaned)
- Migrations 001-005 missing (need pg_dump)
- Gallery image race condition (count not atomic)
- Feed endpoint format mismatch (backend array vs Flutter paginated)
- Gamification point dedup (follow/unfollow manipulation)
