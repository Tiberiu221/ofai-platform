# 02 — Offer Limits Per Business

> **Scop:** Enforce max active offers per business based on subscription tier (Free=2, Standard=10, Premium=unlimited).
> **Dependinte:** `00-subscription-foundation.md` (tabele DB, tier helpers, middleware)
> **Fisiere afectate:**
> - `src/routes/business-portal.js` — mobile/Flutter offer creation (line ~382)
> - `src/routes/web.js` — web portal offer creation (line ~2176) **DUPLICATE ROUTE!**
> - `src/services/offerService.js` — shared createOffer service (optional: add limit check here instead)
> - `src/views/public/portal/manage.ejs` — soft limit banner UI
> - `src/views/public/portal/offer-form.ejs` — block form if at limit

---

## 1. Count Function

Add to `src/helpers/tiers.js` (append to existing exports):

```js
/**
 * Count active offers for a business.
 * Used by requireLimit('max_active_offers', countActiveOffers).
 * @param {Pool} pool
 * @param {number} businessId
 * @returns {Promise<number>}
 */
async function countActiveOffers(pool, businessId) {
  const { rows } = await pool.query(
    'SELECT COUNT(*)::int AS cnt FROM offers WHERE business_id = $1 AND is_active = true',
    [businessId]
  );
  return rows[0].cnt;
}

module.exports = { TIERS, getPlans, getBusinessTier, hasFeature, checkLimit, invalidateCache, countActiveOffers };
```

**Why `is_active = true` only:** Deactivated offers do not count against the limit. This means deactivating an offer frees up a slot immediately. Expired offers are auto-deactivated by the cron job at 03:45 UTC (`cronJobs.js` line 76).

---

## 2. Apply Middleware on Business Portal Route (business-portal.js)

### 2a. Import (at top, after existing imports ~line 9)

```js
const { attachTier, requireLimit } = require('../middleware/tierAuth');
const { countActiveOffers } = require('../helpers/tiers');
```

### 2b. Attach tier globally (after businessAuth setup, before routes)

If `attachTier(pool)` was already wired in Plan 00, skip this. Otherwise add:

```js
// After the existing businessAuth middleware on the router:
router.use('/:businessId', attachTier(pool));
```

**Important:** `attachTier` reads `req.params.businessId` — the param name in business-portal.js is `:businessId` (camelCase). The middleware already handles both `:businessId` and `:bid` (see `tierAuth.js` line 249).

### 2c. Guard the POST route (line ~382)

**Before:**
```js
router.post("/:businessId/offers", businessAuth, upload.single("image"), async (req, res) => {
```

**After:**
```js
router.post("/:businessId/offers", businessAuth, requireLimit('max_active_offers', countActiveOffers), upload.single("image"), async (req, res) => {
```

Middleware order: `businessAuth` -> `requireLimit` -> `upload.single` -> handler.

`requireLimit` runs BEFORE multer processes the file upload, so if the limit is hit, we reject immediately without wasting bandwidth on the uploaded image.

**Note:** `attachTier` must run before `requireLimit`. Since `attachTier` is on `router.use('/:businessId', ...)`, it runs for all `/:businessId/*` routes automatically.

---

## 3. Apply Middleware on Web Portal Route (web.js)

### 3a. Import (at top of web.js, after existing imports)

```js
const { attachTier, requireLimit } = require('../middleware/tierAuth');
const { countActiveOffers } = require('../helpers/tiers');
```

### 3b. Attach tier on portal routes

Web.js uses `requireBusinessOwner` middleware. We need `attachTier` to run for portal routes. Add after the existing portal route group:

```js
// Apply tier info to all portal routes
// Place this BEFORE the individual portal route definitions (~line 1764)
router.use('/api/web/portal/:businessId', attachTier(pool));
```

**Param name check:** Web portal routes use `:businessId` in the path `/api/web/portal/:businessId/offers`, which matches `attachTier`'s param extraction.

### 3c. Guard the POST route (line ~2176)

**Before:**
```js
router.post("/api/web/portal/:businessId/offers", requireBusinessOwner, async (req, res) => {
```

**After:**
```js
router.post("/api/web/portal/:businessId/offers", requireBusinessOwner, requireLimit('max_active_offers', countActiveOffers), async (req, res) => {
```

Middleware order: `requireBusinessOwner` -> `requireLimit` -> handler.

---

## 4. API Response on Limit Hit

The `requireLimit` middleware (from `tierAuth.js`) already returns:

```json
{
  "error": "limit_reached",
  "message": "Ai atins limita de 2 pentru planul tău (Gratuit).",
  "currentTier": "free",
  "limit": 2,
  "current": 2
}
```

HTTP status: **403 Forbidden**.

**Frontend handling (web):** In `manage.ejs`, the offer creation IIFE (`apiFetch`) should check for 403 + `error === 'limit_reached'` and display an upgrade banner instead of a generic error.

**Frontend handling (Flutter):** In the Flutter app's offer creation screen, the Dio interceptor should catch 403 and parse the JSON body. If `error === 'limit_reached'`, show a dialog with the limit info and an upgrade CTA.

---

## 5. Soft Limit UI: Upgrade Banner in Portal Offer List

### 5a. Pass tier info to manage.ejs

In `web.js`, the route that renders the portal dashboard (`GET /portal/:businessId`, line ~1764) already fetches offers. Add tier info to the render data:

```js
// In the GET /portal/:businessId route handler, after existing queries:
const tierInfo = req.tier || { plan: { max_active_offers: 2 }, tier: 'free' };
const activeOfferCount = offers.filter(o => o.is_active).length;

res.render("public/portal/manage", {
  // ... existing props ...
  tierInfo: {
    tier: tierInfo.tier,
    planName: tierInfo.plan.name,
    maxActiveOffers: tierInfo.plan.max_active_offers,  // null = unlimited
    activeOfferCount,
    isAtLimit: tierInfo.plan.max_active_offers !== null && activeOfferCount >= tierInfo.plan.max_active_offers,
    isNearLimit: tierInfo.plan.max_active_offers !== null && activeOfferCount >= tierInfo.plan.max_active_offers - 1,
  },
});
```

### 5b. Upgrade banner in manage.ejs

In `manage.ejs`, inside the `tab-oferte` panel (line ~759), right after the `offers-header` div:

```html
<% if (tierInfo.isAtLimit) { %>
  <div class="tier-limit-banner tier-limit-banner--error">
    <div class="tier-limit-icon">&#9888;</div>
    <div class="tier-limit-text">
      <strong>Ai atins limita de <%= tierInfo.maxActiveOffers %> oferte active</strong>
      <span>pentru planul <%= tierInfo.planName %>. Fă upgrade pentru mai multe oferte.</span>
    </div>
    <a href="/portal/<%= business.id %>#abonament" class="tier-limit-cta">Upgrade</a>
  </div>
<% } else if (tierInfo.isNearLimit) { %>
  <div class="tier-limit-banner tier-limit-banner--warning">
    <div class="tier-limit-text">
      <strong><%= tierInfo.activeOfferCount %>/<%= tierInfo.maxActiveOffers %> oferte active</strong>
      <span>Mai ai loc pentru <%= tierInfo.maxActiveOffers - tierInfo.activeOfferCount %> ofert<%= (tierInfo.maxActiveOffers - tierInfo.activeOfferCount) === 1 ? 'ă' : 'e' %>.</span>
    </div>
  </div>
<% } %>
```

### 5c. CSS for the banner (add to manage.ejs `<style>` block)

```css
.tier-limit-banner {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 16px;
  border-radius: 8px;
  margin-bottom: 16px;
  font-size: 0.875rem;
}
.tier-limit-banner--error {
  background: rgba(239, 68, 68, 0.1);
  border: 1px solid rgba(239, 68, 68, 0.3);
  color: #fca5a5;
}
.tier-limit-banner--warning {
  background: rgba(251, 146, 60, 0.1);
  border: 1px solid rgba(251, 146, 60, 0.3);
  color: #fb923c;
}
.tier-limit-icon { font-size: 1.25rem; }
.tier-limit-text { flex: 1; }
.tier-limit-text strong { display: block; margin-bottom: 2px; }
.tier-limit-text span { opacity: 0.8; }
.tier-limit-cta {
  padding: 6px 16px;
  background: #fb923c;
  color: #06060a;
  border-radius: 6px;
  text-decoration: none;
  font-weight: 600;
  white-space: nowrap;
}
```

### 5d. Disable "Adaugă ofertă" button when at limit

In the offers-header section of manage.ejs (~line 760), the "Adaugă ofertă" link should be conditionally disabled:

```html
<% if (tierInfo.isAtLimit) { %>
  <span class="btn-add-offer btn-add-offer--disabled" title="Limită atinsă — fă upgrade">
    + Ofertă nouă
  </span>
<% } else { %>
  <a href="/portal/<%= business.id %>/oferta-noua" class="btn-add-offer">+ Ofertă nouă</a>
<% } %>
```

---

## 6. offer-form.ejs Server-Side Block

In the `GET /portal/:businessId/oferta-noua` route (web.js line ~1958), add a limit check before rendering:

```js
router.get("/portal/:businessId/oferta-noua", requireBusinessOwner, async (req, res) => {
  // Check offer limit before showing form
  if (req.tier) {
    const { countActiveOffers } = require('../helpers/tiers');
    const count = await countActiveOffers(pool, parseInt(req.params.businessId));
    const limit = req.tier.plan.max_active_offers;
    if (limit !== null && count >= limit) {
      // Redirect back to portal with error message
      return res.redirect(`/portal/${req.params.businessId}?err=offer_limit_reached#oferte`);
    }
  }
  // ... existing render logic ...
});
```

---

## 7. Flutter App Changes

### 7a. Offer creation screen — check before submit

In `ofai_flutter/lib/features/business_portal/` (or wherever offer creation is), the submit handler should catch the 403:

```dart
try {
  final response = await apiClient.post(
    '/$businessId/offers',
    data: offerData,
  );
  // success
} on DioException catch (e) {
  if (e.response?.statusCode == 403) {
    final data = e.response?.data;
    if (data is Map && data['error'] == 'limit_reached') {
      // Show upgrade dialog
      showDialog(
        context: context,
        builder: (_) => AlertDialog(
          title: const Text('Limită atinsă'),
          content: Text(
            'Ai ${data['current']} oferte active din ${data['limit']} permise '
            'pe planul ${data['currentTier']}. Fă upgrade pentru mai multe.',
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.pop(context),
              child: const Text('OK'),
            ),
          ],
        ),
      );
      return;
    }
  }
  // generic error handling
}
```

### 7b. Business portal offer list — show counter

When fetching offers for the portal list, also fetch `GET /:businessId/subscription` (created in Plan 00) and display:

```
Oferte active: 2/2 (Gratuit)
```

---

## 8. Gotchas

### 8a. Race condition — two concurrent creates

**Scenario:** Business owner opens two browser tabs, clicks "Create" on both simultaneously. Both pass the `requireLimit` check (count=1, limit=2), both create offers (count=3, exceeding limit).

**Mitigation options (pick one):**

1. **Advisory lock in offerService.createOffer** (recommended):
   ```sql
   -- At the start of the transaction in offerService.js:
   SELECT pg_advisory_xact_lock(hashtext('offer_limit_' || $1::text));
   -- Then re-check count inside transaction
   SELECT COUNT(*)::int FROM offers WHERE business_id = $1 AND is_active = true;
   ```
   This serializes offer creation per business. Lock is released when transaction commits/rolls back.

2. **Partial index** (simpler, less precise):
   Not practical since limits vary per tier.

**Recommended approach:** Add the advisory lock + count re-check inside `offerService.createOffer`:

```js
// In offerService.js createOffer(), right after BEGIN:
await client.query("BEGIN");

// Advisory lock per business to prevent race condition on limit check
await client.query(
  "SELECT pg_advisory_xact_lock(hashtext('offer_limit_' || $1::text))",
  [String(businessId)]
);
```

The `requireLimit` middleware serves as the fast path (rejects without DB lock for most cases). The advisory lock inside the transaction is the safety net for concurrent requests.

### 8b. Deactivating offers frees up slots immediately

When a business owner toggles `is_active = false` on an offer (via the toggle endpoint in manage.ejs), the count decreases immediately. They can then create a new offer. This is intentional and correct behavior.

### 8c. Expired offers auto-deactivated by cron

The cron job (`cronJobs.js` line 76) runs daily at 03:45 UTC and sets `is_active = FALSE` on offers past their `end_date`. This means:
- Between midnight and 03:45 UTC, an expired-but-not-yet-deactivated offer still counts against the limit.
- This is acceptable for an MVP. If needed later, change the count query to exclude expired offers:
  ```sql
  SELECT COUNT(*)::int FROM offers
  WHERE business_id = $1
    AND is_active = true
    AND (end_date IS NULL OR end_date >= CURRENT_DATE)
  ```

### 8d. BOTH routes must be guarded

The offer creation exists in:
1. `business-portal.js` line 382: `POST /:businessId/offers` (used by Flutter/mobile)
2. `web.js` line 2176: `POST /api/web/portal/:businessId/offers` (used by web portal)

**Both must have the `requireLimit` middleware.** Missing one creates a bypass.

### 8e. Update route does NOT need limit check

`PUT /:businessId/offers/:offerId` (update existing offer) does NOT need a limit check because it modifies an existing offer, not creating a new one. However, if the update toggles `is_active` from `false` to `true`, that is effectively "activating" an offer. Consider whether re-activation should check the limit:

- **Simple approach (recommended for MVP):** Do NOT check on update. The owner already created the offer while within limits.
- **Strict approach:** Add a limit check on PUT only when `is_active` is being changed to `true` and was previously `false`. This adds complexity.

### 8f. req.tier may be undefined on web.js portal routes

If `attachTier` fails silently (it catches errors and calls `next()`), `req.tier` will be `undefined`. The `requireLimit` middleware checks `if (!req.tier)` and returns 500. This is the correct fail-closed behavior for limit enforcement.

### 8g. pool reference in requireLimit

The `requireLimit` middleware calls `countFn(req.app.get('pool'), businessId)`. Verify that `pool` is registered on the Express app:

```js
// In index.js (should already exist):
app.set('pool', pool);
```

If `pool` is NOT set on the app, `requireLimit` will pass `undefined` to `countActiveOffers`, which will throw. **Alternative:** Pass `pool` directly when constructing the middleware:

```js
// In tierAuth.js, change requireLimit to accept pool:
function requireLimit(pool, limitKey, countFn) { ... }

// Usage:
requireLimit(pool, 'max_active_offers', countActiveOffers)
```

Check `index.js` to determine which pattern is used.

---

## 9. Testing Checklist

- [ ] Create offer as free tier (count < 2): should succeed
- [ ] Create offer as free tier (count = 2): should return 403 + `limit_reached`
- [ ] Deactivate one offer, then create: should succeed (count dropped to 1)
- [ ] Create offer as standard tier (count < 10): should succeed
- [ ] Create offer as premium tier (any count): should always succeed (limit = NULL)
- [ ] Web portal manage.ejs shows upgrade banner when at limit
- [ ] "Adaugă ofertă" button disabled when at limit
- [ ] `/portal/:businessId/oferta-noua` redirects when at limit
- [ ] BOTH routes reject (business-portal.js AND web.js)
- [ ] Flutter error dialog shows on 403 limit_reached
- [ ] Concurrent create test: open 2 tabs at count=1/limit=2, submit both -- only 1 should succeed
