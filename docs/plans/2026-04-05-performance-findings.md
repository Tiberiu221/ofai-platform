# Performance Findings — 5 Apr 2026

Rezultate din `/optimize` scan pe întreaga bază de cod.

## P1 — Next Sprint

### 1. CachedNetworkImage fără memCacheWidth/Height (17 instanțe)
Imagini full-resolution în memorie pe device → RAM excesiv.

| Fișier | Instanțe |
|--------|----------|
| business_detail_screen.dart | 2 |
| home_screen.dart | 2 |
| offer_detail_screen.dart | 2 |
| business_card.dart | 2 |
| featured_offer_card.dart | 2 |
| fullscreen_gallery.dart | 1 |
| masonry_gallery.dart | 1 |
| offer_card.dart | 2 |
| search_suggest_dropdown.dart | 1 |
| collection_detail_screen.dart | 1 |
| review_card.dart | 1 |

**Fix:** Adaugă `memCacheWidth` pe fiecare (ex: 400 pt thumbnails, 800 pt hero).

### 2. Cache lipsă pe /oferte și /business-uri (web)
72 queries în web.js, paginile /oferte și /business-uri (cele mai vizitate) nu au cache.

**Fix:** `cache.cached('oferte:page:X:filters', 5 * 60 * 1000, ...)` cu invalidare pe CRUD oferte/business.

## P2 — Backlog

### 3. `<img>` fără `loading="lazy"` (10 instanțe web)
Majoritatea în admin (low impact), dar `blog-post.ejs` hero image ar beneficia.

**Fix:** Adaugă `loading="lazy"` pe below-fold images.

### 4. CSS bundle 211KB (necomprimat)
Cu gzip ~40-50KB. Acceptabil, dar minificare ar ajuta.

**Fix:** CSS minification în build step (sau Cloudflare auto-minify).

## P3 — Nice to have

### 5. `SELECT * FROM subscription_plans` fără LIMIT
web.js:2567 — doar 3 rows, impact neglijabil.

## ✅ Corect by design (nu necesită acțiune)
- Popular offers `RANDOM()` — variază per request, nu se cachează
- Deal of Day cached 30min ✅
- Admin analytics cached 15min ✅
- Blog cached 15min list / 30min post ✅
- 0 N+1 patterns ✅
- 55 Promise.all() usages ✅
- Static data cached (categories 2h, cities 24h) ✅

---

---

# Test Coverage Gaps — `/test-expand`

## Status curent
- **Backend:** 3 test files, 19 tests (DOAR helpers: jwt, tiers, search) — 0 route/integration tests
- **Flutter:** 10 test files, 89 passing, 17 failing — models + 3 widget tests
- **Flutter failing:** offer_card_test.dart (17 failures) — widget s-a schimbat, testele nu au fost actualizate

## Gap analysis

### Backend (0% route coverage)

| Prioritate | Modul | Fișiere | Endpoints | Testat? |
|-----------|-------|---------|-----------|---------|
| **P0** | Auth (login, register, refresh) | auth.js | ~8 | ❌ |
| **P0** | Billing (checkout, webhook) | billing.js | ~6 | ❌ |
| **P0** | Tier enforcement | tiers.js, tierAuth.js | middleware | ✅ helpers only |
| **P1** | Offers CRUD | offers.js | ~10 | ❌ |
| **P1** | Businesses CRUD | businesses.js | ~8 | ❌ |
| **P1** | Push notifications | push-tokens.js | ~5 | ❌ |
| **P2** | Favorites | favorites.js | ~4 | ❌ |
| **P2** | Reviews | reviews.js | ~6 | ❌ |
| **P2** | Collections | collections.js | ~4 | ❌ |
| **P3** | Admin | admin.js | ~40 | ❌ |
| **P3** | Categories/Cities | categories.js, cities.js | ~4 | ❌ |

### Flutter

| Prioritate | Modul | Fișiere | Testat? |
|-----------|-------|---------|---------|
| ✅ | Models (offer, business, collection, report, user) | 5 | ✅ 62 tests |
| ✅ | Formatters utility | 1 | ✅ |
| ❌ **P1** | offer_card widget | 1 | ❌ 17 failing (outdated) |
| ❌ **P1** | business_card widget | 1 | Partial |
| ❌ **P2** | Providers (auth, offers, etc) | 20 | ❌ 0 tests |
| ❌ **P2** | New widgets (masonry, stepper, sticky_cta, venue_detail) | 4 | ❌ 0 tests |
| ❌ **P3** | Screens | 26 | ❌ 0 tests |

## Acțiuni necesare
1. **Fix offer_card_test.dart** — actualizare la noul widget (17 failures)
2. **Backend auth tests** — P0, cel mai critic gap
3. **Backend billing tests** — P0, teste pe webhook handlers
4. **Flutter provider tests** — P2, mock ApiClient cu mocktail

---

---

# Security Findings — `@security-auditor`

## Findings

### [MEDIUM] Stored XSS via JSON.stringify în pricing.ejs
- **File:** `src/views/public/pricing.ejs:307`
- **Issue:** `<%- JSON.stringify(userBusinesses || []) %>` fără escape `</` — business name malițios poate sparge script tag
- **Fix:** Adaugă `.replace(/<\//g, '<\\/')`

### [MEDIUM] Stored XSS via JSON.stringify în admin analytics (13 instanțe)
- **File:** `src/views/admin/analytics.ejs:150,166,186,197,203,216,224,243,255,266,274,285,296`
- **Issue:** JSON.stringify cu business names/offer titles user-controlled, fără `</` escape
- **Fix:** `.replace(/<\//g, '<\\/')` pe toate cele 13 JSON.stringify calls

### [MEDIUM] CSRF lipsă pe admin onboarding forms
- **File:** `src/routes/admin.js:3107-3109`
- **Issue:** Inline HTML forms fără `_csrf` hidden input → POST-uri vor da 403
- **Fix:** Adaugă `_csrf` hidden field sau migrare la EJS template

### [LOW] CSP script-src-attr allows unsafe-inline
- **File:** `src/index.js:146`
- **Issue:** 54+ inline onclick handlers necesită `unsafe-inline` — slăbește CSP
- **Fix:** Migrare la event listeners (non-trivial, Phase 2)

### [LOW] Error message leak în admin-analytics
- **File:** `src/routes/admin-analytics.js:441`
- **Issue:** `err.message` expus când `NODE_ENV` nu e setat
- **Fix:** Default to safe branch

## ✅ Confirmate clean
- SQL Injection: 0 vulnerabilități (toate queries parametrizate)
- Auth middleware: toate route-urile protejate corect
- LLM fencing: toate 5 servicii au `[USER_INPUT]` fencing corect
- Secrets: 0 hardcoded (toate din process.env)
- CSP Nonce: toate `<script>` au nonce corect
- CSRF: corect pe web routes, skip pe webhook + mobile
- Stripe: webhook signature verification + idempotency OK

---

---

# Debug Findings — `@debugger`

## offer_card_test.dart — 17 failures (9 test cases × error cascade)

### Root Cause
Testele lipsesc `localizationsDelegates` + `supportedLocales` în `_buildTestApp()`.
Widget-ul folosește `AppLocalizations.of(context)!` în 4 locuri (l.363, 501, 653, 684).
`_buildFavoriteIcon` (l.501) e primul apelat → `Null check operator used on a null value` → widget crash → toate `find.text()` găsesc 0 widgets.

### Fix necesar
1. Adaugă `localizationsDelegates: AppLocalizations.localizationsDelegates` + `supportedLocales: AppLocalizations.supportedLocales` în `MaterialApp` din `_buildTestApp()`
2. (Opțional, pt tap tests) Înlocuiește `MaterialApp` cu `MaterialApp.router` + `GoRouter` mock

### Impact
Widget-ul e corect — doar testele sunt outdated după redesign.

---

# Plan Complet de Acțiune

## Faza 1 — CRITICAL (Security)
- [ ] Fix XSS pricing.ejs JSON.stringify (adaugă `.replace(/<\//g, '<\\/')`)
- [ ] Fix XSS admin analytics.ejs (13 JSON.stringify calls)
- [ ] Fix CSRF admin onboarding forms (adaugă `_csrf` hidden input)

## Faza 2 — HIGH (Performance + Tests)
- [ ] Adaugă `memCacheWidth` pe 17 CachedNetworkImage instanțe
- [ ] Cache pe /oferte și /business-uri (web.js)
- [ ] Fix offer_card_test.dart (localization delegates)
- [ ] Scrie backend auth tests (P0 gap)
- [ ] Scrie backend billing tests (P0 gap)

## Faza 3 — MEDIUM (Quality)
- [ ] Fix admin-analytics error message leak
- [ ] `loading="lazy"` pe below-fold images web
- [ ] Scrie backend offers/businesses tests (P1)
- [ ] Scrie Flutter provider tests (P2)

## Faza 4 — LOW (Nice to have)
- [ ] CSP unsafe-inline migration (54+ handlers)
- [ ] CSS minification
- [ ] Backend admin route tests (P3)
