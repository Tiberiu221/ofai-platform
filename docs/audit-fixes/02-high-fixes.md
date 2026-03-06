# Audit #9 — HIGH Fixes Implementation Prompt

**Instrucțiuni:** Copiază tot conținutul de mai jos ca prompt într-o sesiune nouă Claude Code. Promptul este self-contained. Rulează DUPĂ ce CRITICAL fixes au fost aplicate.

---

## PROMPT START

Implementează următoarele 14 fix-uri HIGH din Audit #9. Fiecare fix are fișierul, linia exactă, codul curent, și codul nou. După fiecare fix, verifică că serverul pornește. Commit final pe branch-ul curent.

**REGULI:**
- NU modifica nimic legat de Stripe (billing.js, stripe.js, subscriptionService.js)
- Folosește exact pattern-urile existente în cod
- Comentarii în engleză, UI text în română

---

### FIX 1: HIGH-02 — Web login nu revocă refresh tokens existente

**Fișier:** `appredueri_backend/src/routes/web.js`
**Linia:** ~1344-1347 (după `if (user.banned_at)` check, ÎNAINTE de `const token = signToken(...)`)

Adaugă ÎNAINTE de `const token = signToken({ id: user.id }, "24h");`:

```js
    // Revoke existing refresh tokens to prevent session fixation
    await pool.query(
      "UPDATE refresh_tokens SET revoked_at = NOW() WHERE user_id = $1 AND revoked_at IS NULL",
      [user.id]
    );
```

**RISC:** Alte device-uri/tab-uri vor fi deloggate. Aceasta e comportament dorit de securitate — utilizatorii pot reloga din alte dispozitive.

---

### FIX 2: HIGH-03 — Mobile reveal-code fără rate limiter

**Fișier:** `appredueri_backend/src/routes/offers.js`
**Linia:** 656

**Cod curent:**
```js
router.post("/:id/reveal-code", auth, async (req, res) => {
```

**Cod nou:**
```js
router.post("/:id/reveal-code", revealLimiter, auth, async (req, res) => {
```

Verifică că `revealLimiter` e importat la top-ul fișierului. Caută import-ul `rateLimiter` — dacă nu există, adaugă:
```js
const { revealLimiter } = require("../middleware/rateLimiter");
```

Dacă `revealLimiter` nu e exportat din `rateLimiter.js`, verifică ce rate limitere sunt disponibile acolo și folosește-l pe cel potrivit. Web endpoint-ul la `web.js:973` DEJA folosește `revealLimiter`.

**RISC:** Zero — rate limiter-ul permite ~20 req/min per IP.

---

### FIX 3: HIGH-05 — Promo code limit nu se verifică pe UPDATE

**Fișier:** `appredueri_backend/src/routes/business-portal.js`
**Linia:** 692-703 (în PUT handler pentru update offer)

**Cod curent (linia 695-703):**
```js
      if (Array.isArray(promoCodesArr)) {
          const validCodes = promoCodesArr.filter(pc => pc.code && pc.code.trim());
          for (const pc of validCodes) {
            await client.query(
              "INSERT INTO promo_codes (offer_id, code, is_active) VALUES ($1, $2, $3)",
              [offerId, sanitizeString(pc.code.trim(), 100), pc.is_active !== false]
            );
          }
        }
```

**Cod nou — adaugă ÎNAINTE de loop-ul `for`, DUPĂ `const validCodes`:**
```js
      if (Array.isArray(promoCodesArr)) {
          const validCodes = promoCodesArr.filter(pc => pc.code && pc.code.trim());

          // Enforce tier limit on promo codes
          if (req.tier && req.tier.plan && process.env.TIER_GATING_ENABLED === 'true') {
            const promoLimit = req.tier.plan.max_promo_codes_per_offer;
            if (promoLimit !== null && validCodes.length > promoLimit) {
              await client.query("ROLLBACK");
              return res.status(403).json({
                error: 'limit_reached',
                message: `Maximum ${promoLimit} coduri promoționale per ofertă pe planul ${req.tier.plan.name}.`,
              });
            }
          }

          for (const pc of validCodes) {
```

Verifică că `attachTier()` middleware este aplicat pe ruta PUT. Caută definiția rutei PUT la linia 574 — dacă nu are `attachTier()`, adaugă-l:
```js
router.put("/:businessId/offers/:offerId", businessAuth, attachTier(), upload.single("image"), async (req, res) => {
```

Dacă `attachTier` nu e importat, adaugă la top:
```js
const { attachTier } = require("../middleware/tierAuth");
```

**RISC:** Low. Doar adaugă un guard. `req.tier` poate fi null dacă middleware nu e aplicat — check-ul `req.tier &&` previne crash.

---

### FIX 4: HIGH-06 — Cron ON CONFLICT DO NOTHING — adaugă logging

**Fișier:** `appredueri_backend/src/services/cronJobs.js`
**Liniile:** 118-122 și 154-158

La **ambele** locuri (trial downgrade și paid downgrade), după INSERT-ul cu `ON CONFLICT DO NOTHING`, adaugă verificare rowCount.

**Linia ~121 (trial):** Schimbă din:
```js
          await client.query(`
            INSERT INTO business_subscriptions (business_id, plan_id, status, billing_cycle)
            VALUES ($1, $2, 'active', 'none')
            ON CONFLICT DO NOTHING
          `, [row.business_id, freePlanId]);
```
în:
```js
          const insertRes = await client.query(`
            INSERT INTO business_subscriptions (business_id, plan_id, status, billing_cycle)
            VALUES ($1, $2, 'active', 'none')
            ON CONFLICT DO NOTHING
          `, [row.business_id, freePlanId]);
          if (insertRes.rowCount === 0) {
            console.warn(`[Cron] Free plan insert skipped for business ${row.business_id} — active subscription already exists`);
          }
```

Aplică **exact același pattern** la linia ~157 (paid downgrade).

**RISC:** Zero — doar logging aditional.

---

### FIX 5: HIGH-07 — Admin path traversal la ștergere imagine

**Fișier:** `appredueri_backend/src/routes/admin.js`
**Linia:** 60

**Cod curent:**
```js
      const safePath = path.join(__dirname, "..", imageUrl); // ../uploads/...
      if (fs.existsSync(safePath)) {
        fs.unlink(safePath, () => { });
      }
```

**Cod nou:**
```js
      const baseDir = path.resolve(__dirname, "..");
      const resolved = path.resolve(__dirname, "..", imageUrl);
      if (!resolved.startsWith(baseDir + path.sep)) {
        console.error("[Admin] Path traversal attempt blocked:", imageUrl);
        return;
      }
      if (fs.existsSync(resolved)) {
        fs.unlink(resolved, () => { });
      }
```

**RISC:** Zero — doar adaugă validare. `path.sep` asigură că `/app` nu match-uiește `/application`.

---

### FIX 6: HIGH-08/11 — innerHTML XSS în manage.ejs

**Fișier:** `appredueri_backend/src/views/public/portal/manage.ejs`

**6a. Linia 1879 — Gallery upload innerHTML cu URL nevalidat:**

**Cod curent:**
```js
placeholder.innerHTML = '<img src="' + data.image.url + '" alt="Galerie" width="120" height="80" loading="lazy">' +
  '<button type="button" class="gallery-delete-btn" onclick="deleteGalleryImage(' + data.image.id + ', this)" title="Șterge imaginea" aria-label="Șterge imaginea">&times;</button>';
```

**Cod nou** — folosește DOM API în loc de innerHTML:
```js
var img = document.createElement('img');
img.src = data.image.url;
img.alt = 'Galerie';
img.width = 120;
img.height = 80;
img.loading = 'lazy';
var btn = document.createElement('button');
btn.type = 'button';
btn.className = 'gallery-delete-btn';
btn.title = 'Șterge imaginea';
btn.setAttribute('aria-label', 'Șterge imaginea');
btn.innerHTML = '&times;';
btn.onclick = function() { deleteGalleryImage(data.image.id, this); };
placeholder.innerHTML = '';
placeholder.appendChild(img);
placeholder.appendChild(btn);
```

**6b. Linia 2211 — plan.name în innerHTML:**

**Cod curent:**
```js
html += '<h3 style="font-size: 1.25rem; font-weight: 600; color: var(--text-primary); margin: 0;">Planul tau: <span style="color: ' + tierColor + ';">' + plan.name + '</span></h3>';
```

**Cod nou:**
```js
html += '<h3 style="font-size: 1.25rem; font-weight: 600; color: var(--text-primary); margin: 0;">Planul tau: <span style="color: ' + tierColor + ';">' + escapeHtml(plan.name) + '</span></h3>';
```

`escapeHtml()` e deja definit la linia 2922 din manage.ejs. Dacă funcția `renderSubscriptionCard` e definită ÎNAINTE de `escapeHtml`, mută definiția `escapeHtml` mai sus, sau inline-ează escape-ul: `plan.name.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')`.

**RISC:** Zero — escape pur textual.

---

### FIX 7: HIGH-12 — Flutter businesses_provider shared cancel token

**Fișier:** `ofai_flutter/lib/providers/businesses_provider.dart`

Adaugă un al doilea CancelToken pentru loadMore. Caută declarația `CancelToken? _cancelToken;` și adaugă:
```dart
CancelToken? _loadMoreToken;
```

În metoda `loadMore()`, înlocuiește `cancelToken: _cancelToken` cu `cancelToken: _loadMoreToken`:
```dart
Future<void> loadMore() async {
    if (state.isLoadingMore || !state.hasMore) return;
    if (state.businesses.length >= _maxItems) return;
    _loadMoreToken?.cancel();
    _loadMoreToken = CancelToken();
    state = state.copyWith(isLoadingMore: true);
    try {
      final nextPage = state.page + 1;
      final response = await _api.dio.get(
        ApiEndpoints.businesses,
        queryParameters: _params(nextPage),
        cancelToken: _loadMoreToken,
      );
```

În metoda `fetch()`, anulează și `_loadMoreToken`:
```dart
Future<void> fetch() async {
    _cancelToken?.cancel();
    _loadMoreToken?.cancel();
    _cancelToken = CancelToken();
```

**RISC:** Low. Doar separă cancel token-urile.

---

### FIX 8: HIGH-13 — updateProfilePicture pierde displayBadgeId

**Fișier:** `ofai_flutter/lib/providers/auth_provider.dart`
**Linia:** 245-259

**Cod curent:**
```dart
        state = state.copyWith(user: User(
          id: u.id,
          email: u.email,
          firstName: u.firstName,
          lastName: u.lastName,
          role: u.role,
          preferredCityIds: u.preferredCityIds,
          preferredCategoryIds: u.preferredCategoryIds,
          points: u.points,
          createdAt: u.createdAt,
          profilePictureUrl: url,
          hasPassword: u.hasPassword,
          badges: u.badges,
          showPictureInReviews: u.showPictureInReviews,
        ));
```

**Cod nou — adaugă `displayBadgeId`:**
```dart
        state = state.copyWith(user: User(
          id: u.id,
          email: u.email,
          firstName: u.firstName,
          lastName: u.lastName,
          role: u.role,
          preferredCityIds: u.preferredCityIds,
          preferredCategoryIds: u.preferredCategoryIds,
          points: u.points,
          createdAt: u.createdAt,
          profilePictureUrl: url,
          hasPassword: u.hasPassword,
          badges: u.badges,
          showPictureInReviews: u.showPictureInReviews,
          displayBadgeId: u.displayBadgeId,
        ));
```

**RISC:** Zero — User model (user.dart:15) are `final int? displayBadgeId` declarat.

---

### FIX 9: HIGH-14 — SearchSuggestNotifier fără CancelToken

**Fișier:** `ofai_flutter/lib/providers/search_suggest_provider.dart`

Adaugă un câmp CancelToken. Caută `String? _activeQuery;` și adaugă după:
```dart
  CancelToken? _cancelToken;
```

În metoda `search()`, ÎNAINTE de request, adaugă:
```dart
    _cancelToken?.cancel();
    _cancelToken = CancelToken();
```

La `_api.dio.get()`, adaugă parametrul:
```dart
      final resp = await _api.dio.get(
        ApiEndpoints.searchSuggest,
        queryParameters: {'q': query},
        cancelToken: _cancelToken,
      );
```

Adaugă import dacă lipsește:
```dart
import 'package:dio/dio.dart';
```

**RISC:** Zero — standard Dio pattern. `_activeQuery` staleness check la linia 113 rămâne ca fallback.

---

### FIX 10: HIGH-23 — Missing env vars în .env.example

**Fișier:** `appredueri_backend/.env.example`

Adaugă la FINAL:

```env

# ─── Stripe (skeleton, not production-ready) ───
# STRIPE_SECRET_KEY=sk_test_xxx
# STRIPE_PUBLISHABLE_KEY=pk_test_xxx
# STRIPE_WEBHOOK_SECRET=whsec_xxx

# ─── Tier Gating ───
# Set to 'true' to enforce subscription-based feature limits
TIER_GATING_ENABLED=false

# ─── CSRF ───
# Separate CSRF secret (falls back to JWT_SECRET if not set)
# CSRF_SECRET=REDACTED

# ─── Google OAuth ───
# GOOGLE_CLIENT_ID=your-google-client-id.apps.googleusercontent.com
```

**RISC:** Zero — doar documentație.

---

### FIX 11: HIGH-26,27 — Indexuri lipsă

**Fișier NOU:** `appredueri_backend/src/migrations/047_missing_indexes.sql`

```sql
-- Migration 047: Add missing indexes identified in Audit #9
-- H3: business_clicks.offer_id — used in Deal-of-Day fallback ORDER BY subquery
-- H4: offer_views(business_id, viewed_at) — used in analytics date-range queries

CREATE INDEX IF NOT EXISTS idx_bclicks_offer_id
  ON business_clicks(offer_id)
  WHERE offer_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_offer_views_bid_date
  ON offer_views(business_id, viewed_at);

-- L5: Drop redundant 2-column index superseded by 3-column composite from migration 028
DROP INDEX IF EXISTS idx_bclicks_action;
```

**RISC:** Index creation pe tabele mari poate lua câteva secunde. `IF NOT EXISTS` asigură idempotența. `DROP INDEX IF EXISTS` e safe — indexul poate să nu existe.

---

### FIX 12: HIGH-29 — Migration gap la 030

**Fișier NOU:** `appredueri_backend/src/migrations/030_placeholder.sql`

```sql
-- Migration 030: Placeholder
-- This migration number was skipped during development.
-- This placeholder fills the gap to maintain sequential numbering.
-- No schema changes.
SELECT 1;
```

**RISC:** Zero.

---

### FIX 13: CRIT-06 (downgraded) — Gallery limit hardcoded 8

**Fișier:** `appredueri_backend/src/routes/web.js`
**Linia:** 2306-2308

**Cod curent:**
```js
    if (parseInt(countRes.rows[0].cnt) >= 8) {
      await client.query("ROLLBACK");
      return res.status(400).json({ message: "Maximum 8 imagini permise" });
    }
```

**Cod nou:**
```js
    // Use tier limit (requireLimit middleware already checks, this is a race-condition backup)
    const galleryLimit = (req.tier && req.tier.plan && req.tier.plan.max_gallery_images !== null)
      ? req.tier.plan.max_gallery_images
      : 64; // Sane fallback matching premium tier (migration 045)
    if (parseInt(countRes.rows[0].cnt) >= galleryLimit) {
      await client.query("ROLLBACK");
      return res.status(400).json({ message: `Maximum ${galleryLimit} imagini permise` });
    }
```

**RISC:** Low. `req.tier` e deja populat de `attachTier()` middleware pe această rută (verifică linia 2293 — are `requireLimit('max_gallery_images', countGalleryImages)` care implicit rulează după `attachTier`). Dacă `req.tier` e null (DB error), fallback la 64.

---

### FIX 14: HIGH-28, HIGH-30 — Doar documentare

Aceste findings NU necesită modificări de cod:

**HIGH-28:** `subscription_plans` FK are `RESTRICT` implicit — documentează în cod:
- Adaugă comentariu în `033_business_subscriptions.sql` la linia 42:
```sql
-- Note: plan_id uses implicit ON DELETE RESTRICT — plans should never be hard-deleted
```

**HIGH-30:** Migration 028 folosește `SERIAL` vs `BIGSERIAL`:
- Adaugă comentariu la top-ul `028_analytics_tables.sql`:
```sql
-- Note: Uses SERIAL (not BIGSERIAL). Production may have BIGSERIAL from legacy migration.
-- For fresh installs, SERIAL is sufficient for foreseeable analytics volume.
```

---

### VERIFICARE FINALĂ

1. `cd appredueri_backend && node src/index.js` — serverul pornește fără erori
2. `cd ofai_flutter && flutter analyze --no-pub` — fără erori noi
3. Commit cu mesaj: `fix: high-priority fixes from audit #9 (rate limiter, path traversal, XSS, indexes)`
4. Push pe branch-ul curent

## PROMPT END
