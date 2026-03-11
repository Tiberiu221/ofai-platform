# 03 — Promo Code Limits Per Offer

> **Scop:** Enforce max promo codes per offer based on subscription tier (Free=0, Standard=3, Premium=unlimited).
> **Dependinte:** `00-subscription-foundation.md` (tabele DB, tier helpers, middleware)
> **Fisiere afectate:**
> - `src/services/offerService.js` — shared createOffer (inserts promo codes in transaction)
> - `src/routes/business-portal.js` — offer create (line ~382), offer update (line ~479)
> - `src/routes/web.js` — offer create (line ~2176), offer update (line ~2225)
> - `src/helpers/tiers.js` — new count function
> - `src/views/public/portal/offer-form.ejs` — hide promo code section for free tier
> - `src/views/public/portal/manage.ejs` — hide promo code column for free tier

---

## 1. Understanding the Data Model

Promo codes live in the `promo_codes` table (migration 021):
```sql
CREATE TABLE promo_codes (
  id SERIAL PRIMARY KEY,
  offer_id INTEGER NOT NULL REFERENCES offers(id) ON DELETE CASCADE,
  code VARCHAR(100) NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

Key points:
- Promo codes belong to an **offer**, not directly to a business.
- The subscription tier limit `max_promo_codes_per_offer` is per-offer (e.g., Standard can have 3 promo codes on each offer).
- The tier is on the **business**, so to check the limit we need: `offer -> business_id -> business_subscriptions -> subscription_plans.max_promo_codes_per_offer`.
- `max_promo_codes_per_offer = 0` means **NO promo codes at all** (not unlimited).
- `max_promo_codes_per_offer = NULL` means **unlimited** (Premium tier).

### Tier values (from migration 033):
| Tier | max_promo_codes_per_offer |
|------|--------------------------|
| Free | 0 |
| Standard | 3 |
| Premium | NULL (unlimited) |

---

## 2. Count Function

Add to `src/helpers/tiers.js`:

```js
/**
 * Count promo codes for a specific offer.
 * Used for per-offer limit enforcement.
 * @param {Pool} pool
 * @param {number} offerId
 * @returns {Promise<number>}
 */
async function countPromoCodesForOffer(pool, offerId) {
  const { rows } = await pool.query(
    'SELECT COUNT(*)::int AS cnt FROM promo_codes WHERE offer_id = $1',
    [offerId]
  );
  return rows[0].cnt;
}
```

**Note:** This counts ALL promo codes (active + inactive) because the limit is about total codes, not just active ones. Toggling a code inactive should not free up a slot.

Update the module.exports:
```js
module.exports = {
  TIERS, getPlans, getBusinessTier, hasFeature, checkLimit, invalidateCache,
  countActiveOffers, countPromoCodesForOffer
};
```

---

## 3. Enforcement Strategy

Unlike offer limits, promo codes are NOT created via a standalone endpoint. They are embedded in the offer create/update flow:

1. **Offer creation** (`offerService.createOffer`): Promo codes are passed as `params.promoCodes` array and inserted in the same transaction.
2. **Offer update** (business-portal.js line ~578, web.js line ~2250): Promo codes are DELETE-all + re-INSERT in a transaction.

This means we cannot use `requireLimit` middleware (which works on standalone routes). Instead, we must **validate inside the handler/service before inserting**.

### Approach: Validate in `offerService.createOffer` + in the update handlers

---

## 4. Changes to `src/services/offerService.js`

### 4a. Import tier helper

```js
const { getBusinessTier } = require('../helpers/tiers');
```

### 4b. Add promo code limit check inside createOffer

After the `BEGIN` and before inserting promo codes (~line 93), add validation:

```js
// After the offer INSERT (line ~89) and before promo code insert (line ~93):

// --- Promo code limit check ---
if (promoCodes && Array.isArray(promoCodes) && promoCodes.length > 0) {
  const { plan } = await getBusinessTier(client, businessId);
  const promoLimit = plan.max_promo_codes_per_offer;

  // promoLimit = 0 means promo codes completely disabled
  // promoLimit = NULL means unlimited
  if (promoLimit !== null) {
    const validCodes = promoCodes.filter(pc => pc.code && pc.code.trim());
    if (validCodes.length > promoLimit) {
      await client.query("ROLLBACK");
      const err = new Error('promo_code_limit');
      err.statusCode = 403;
      err.details = {
        error: 'limit_reached',
        message: promoLimit === 0
          ? `Codurile promoționale nu sunt disponibile pe planul ${plan.name}. Fă upgrade la Standard sau Premium.`
          : `Maximum ${promoLimit} coduri promoționale per ofertă pe planul ${plan.name}.`,
        currentTier: plan.slug,
        limit: promoLimit,
        current: validCodes.length,
        limitKey: 'max_promo_codes_per_offer',
      };
      throw err;
    }
  }
}
```

**Important:** We use `client` (the transaction connection) for `getBusinessTier`, not `pool`. This ensures the query runs inside the transaction. `getBusinessTier` accepts any object with a `.query()` method.

### 4c. Updated createOffer full flow

```js
async function createOffer(pool, params) {
  const {
    businessId, title, description, discountType, discountValue,
    conditions, startDate, endDate, isActive, logoUrl,
    bookingType, bookingPhone, bookingWhatsapp, bookingUrl, bookingInstructions,
    promoCodes, maxReveals, sendWebhook = false,
  } = params;

  const client = await pool.connect();
  let offerId;

  try {
    await client.query("BEGIN");

    // --- Promo code limit check (BEFORE inserting anything) ---
    if (promoCodes && Array.isArray(promoCodes)) {
      const validCodes = promoCodes.filter(pc => pc.code && pc.code.trim());
      if (validCodes.length > 0) {
        const { plan } = await getBusinessTier(client, businessId);
        const promoLimit = plan.max_promo_codes_per_offer;

        if (promoLimit !== null && validCodes.length > promoLimit) {
          await client.query("ROLLBACK");
          const err = new Error('promo_code_limit');
          err.statusCode = 403;
          err.details = {
            error: 'limit_reached',
            message: promoLimit === 0
              ? `Codurile promoționale nu sunt disponibile pe planul ${plan.name}.`
              : `Maximum ${promoLimit} coduri per ofertă pe planul ${plan.name}.`,
            currentTier: plan.slug,
            limit: promoLimit,
            current: validCodes.length,
            limitKey: 'max_promo_codes_per_offer',
          };
          throw err;
        }
      }
    }

    // INSERT offer (existing code, unchanged)
    const result = await client.query(`...existing INSERT...`);
    offerId = result.rows[0].id;

    // INSERT promo codes (existing code, unchanged)
    if (promoCodes && Array.isArray(promoCodes)) {
      const validCodes = promoCodes.filter(pc => pc.code && pc.code.trim());
      for (const pc of validCodes) {
        await client.query(
          "INSERT INTO promo_codes (offer_id, code, is_active) VALUES ($1, $2, $3)",
          [offerId, pc.code.trim(), pc.is_active !== false]
        );
      }
    }

    await client.query("COMMIT");
  } catch (err) {
    await client.query("ROLLBACK").catch(() => {});
    throw err;
  } finally {
    client.release();
  }

  // ... rest of function (webhook, push) unchanged ...
  return offerId;
}
```

---

## 5. Handle the Error in Route Handlers

### 5a. business-portal.js — POST /:businessId/offers (line ~382)

The handler currently has a generic `catch(err)`. Add specific handling for `promo_code_limit`:

```js
} catch (err) {
  // Promo code limit error
  if (err.message === 'promo_code_limit' && err.details) {
    return res.status(err.statusCode || 403).json(err.details);
  }
  console.error("[BusinessPortal] Error creating offer:", err);
  res.status(500).json({ message: "Eroare la creare" });
}
```

### 5b. web.js — POST /api/web/portal/:businessId/offers (line ~2176)

Same pattern:

```js
} catch (err) {
  if (err.message === 'promo_code_limit' && err.details) {
    return res.status(err.statusCode || 403).json(err.details);
  }
  console.error("[Web API] Portal create offer error:", err);
  res.status(500).json({ message: "Eroare server" });
}
```

---

## 6. Offer Update — Promo Code Limit on Edit

### 6a. business-portal.js — PUT /:businessId/offers/:offerId (line ~479)

The update handler deletes all existing promo codes and re-inserts them (line ~598). Add a limit check before re-insert:

```js
// Inside the transaction, after DELETE promo_codes (line ~598):
// BEFORE the insert loop:

if (Array.isArray(promoCodesArr)) {
  const validCodes = promoCodesArr.filter(pc => pc.code && pc.code.trim());

  // Check promo code limit
  if (validCodes.length > 0 && req.tier) {
    const promoLimit = req.tier.plan.max_promo_codes_per_offer;
    if (promoLimit !== null && validCodes.length > promoLimit) {
      await client.query("ROLLBACK");
      return res.status(403).json({
        error: 'limit_reached',
        message: promoLimit === 0
          ? `Codurile promoționale nu sunt disponibile pe planul ${req.tier.plan.name}.`
          : `Maximum ${promoLimit} coduri per ofertă pe planul ${req.tier.plan.name}.`,
        currentTier: req.tier.tier,
        limit: promoLimit,
        current: validCodes.length,
        limitKey: 'max_promo_codes_per_offer',
      });
    }
  }

  // ... existing insert loop ...
}
```

**Note:** `req.tier` is available because `attachTier` runs on all `/:businessId/*` routes (wired in Plan 00 or 02).

### 6b. web.js — PUT /api/web/portal/:businessId/offers/:offerId (line ~2225)

Same logic. The update handler inline does the DELETE + re-INSERT (line ~2257-2270). Add the same limit check between DELETE and INSERT:

```js
// After: await pool.query("DELETE FROM promo_codes WHERE offer_id = $1", [offerId]);
// Before: the insert loop

if (Array.isArray(promoCodesArr)) {
  const validCodes = promoCodesArr.filter(pc => pc.code && pc.code.trim());

  if (validCodes.length > 0 && req.tier) {
    const promoLimit = req.tier.plan.max_promo_codes_per_offer;
    if (promoLimit !== null && validCodes.length > promoLimit) {
      // NOTE: This is NOT in a transaction in web.js update route.
      // The DELETE already happened. We need to handle this gracefully.
      // Option A: Truncate to limit and warn
      // Option B: Return error (codes already deleted — bad UX)
      // Recommended: Switch to transaction-based update (see Gotcha 8c)
      return res.status(403).json({
        error: 'limit_reached',
        message: `Maximum ${promoLimit} coduri per ofertă.`,
        currentTier: req.tier.tier,
        limit: promoLimit,
        current: validCodes.length,
      });
    }
  }

  // ... existing insert loop ...
}
```

**IMPORTANT:** See Gotcha 8c about the web.js update route lacking a transaction wrapper.

---

## 7. UI: Hide Promo Code Section for Free Tier

### 7a. offer-form.ejs

The offer creation/edit form has a promo codes section. Conditionally hide or disable it:

Pass `tierInfo` to the template (same pattern as Plan 02):

```js
// In GET /portal/:businessId/oferta-noua (web.js line ~1958):
res.render("public/portal/offer-form", {
  // ... existing props ...
  promoCodesAllowed: req.tier ? (req.tier.plan.max_promo_codes_per_offer !== 0) : false,
  maxPromoCodes: req.tier ? req.tier.plan.max_promo_codes_per_offer : 0,
  tierName: req.tier ? req.tier.plan.name : 'Gratuit',
});
```

In the EJS template, wrap the promo code section:

```html
<% if (promoCodesAllowed) { %>
  <div class="form-section" id="promo-codes-section">
    <h3>Coduri promoționale</h3>
    <% if (maxPromoCodes !== null) { %>
      <p class="form-hint">Maximum <%= maxPromoCodes %> coduri pe planul <%= tierName %></p>
    <% } %>
    <!-- existing promo code inputs -->
  </div>
<% } else { %>
  <div class="form-section form-section--locked">
    <h3>Coduri promoționale</h3>
    <p class="tier-locked-message">
      Codurile promoționale sunt disponibile pe planurile Standard și Premium.
      <a href="/portal/<%= business.id %>#abonament">Fă upgrade</a>
    </p>
  </div>
<% } %>
```

### 7b. JavaScript: Limit number of promo code inputs

If `maxPromoCodes` is not null, prevent adding more than `maxPromoCodes` input fields in the client-side JS:

```html
<script>
  var maxPromoCodes = <%= maxPromoCodes === null ? 'null' : maxPromoCodes %>;

  function addPromoCode() {
    var currentCount = document.querySelectorAll('.promo-code-input').length;
    if (maxPromoCodes !== null && currentCount >= maxPromoCodes) {
      alert('Maximum ' + maxPromoCodes + ' coduri promoționale pe planul tău.');
      return;
    }
    // ... existing add logic ...
  }
</script>
```

### 7c. manage.ejs — Hide promo code column in offer list for free tier

In the offers table/list in manage.ejs, conditionally hide the promo code column:

```html
<% if (tierInfo.tier !== 'free') { %>
  <td class="offer-promo-codes"><%= offer.promo_code_count || 0 %> coduri</td>
<% } %>
```

---

## 8. Gotchas

### 8a. max_promo_codes_per_offer = 0 means DISABLED (not unlimited)

This is different from `max_active_offers` where `NULL` = unlimited. For promo codes:
- `0` = promo codes completely disabled (Free tier)
- `3` = max 3 codes per offer (Standard tier)
- `NULL` = unlimited (Premium tier)

The check logic must be:
```js
if (promoLimit !== null && validCodes.length > promoLimit) { ... }
```

When `promoLimit = 0` and `validCodes.length = 1`, `1 > 0` is `true` -> rejected. Correct.
When `promoLimit = null`, the entire check is skipped. Correct.

### 8b. Limit is per-OFFER, not per-business

Each offer can have up to N promo codes. A Standard tier business with 10 offers can have 3 codes on EACH offer (30 total). The count function counts codes for a specific offer, not all codes across all offers.

### 8c. web.js update route lacks transaction for promo codes

In `web.js` line ~2257, the promo code delete-and-reinsert is NOT wrapped in a transaction:

```js
// web.js line ~2257 (current code):
await pool.query("DELETE FROM promo_codes WHERE offer_id = $1", [offerId]);
// ... then insert new ones ...
```

If we check the limit AFTER the DELETE but BEFORE the INSERT, and reject, the old promo codes are already gone. This is a data loss bug.

**Fix (MUST DO):** Wrap the web.js offer update in a transaction, same as business-portal.js:

```js
const client = await pool.connect();
try {
  await client.query("BEGIN");

  // Update offer fields
  await client.query(`UPDATE offers SET ...`, [...]);

  // Handle promo codes
  if (promoCodesArr !== undefined) {
    await client.query("DELETE FROM promo_codes WHERE offer_id = $1", [offerId]);

    if (Array.isArray(promoCodesArr)) {
      const validCodes = promoCodesArr.filter(pc => pc.code && pc.code.trim());

      // Limit check
      const promoLimit = req.tier?.plan?.max_promo_codes_per_offer;
      if (promoLimit !== null && validCodes.length > promoLimit) {
        await client.query("ROLLBACK");
        return res.status(403).json({ error: 'limit_reached', ... });
      }

      for (const pc of validCodes) {
        await client.query(
          "INSERT INTO promo_codes (offer_id, code, is_active) VALUES ($1, $2, $3)",
          [offerId, pc.code.trim(), pc.is_active !== false]
        );
      }
    }
  }

  await client.query("COMMIT");
  res.json({ success: true });
} catch (err) {
  await client.query("ROLLBACK").catch(() => {});
  throw err;
} finally {
  client.release();
}
```

### 8d. offerService.createOffer uses pool for getBusinessTier

When calling `getBusinessTier(client, businessId)` inside the transaction, the `client` (from `pool.connect()`) has a `.query()` method, so it works. BUT the `getPlans` cache uses a separate `pool.query` call. Since `getBusinessTier` joins `subscription_plans`, it does not use the cache for the main query — it's fine.

### 8e. Backward compatibility: single promo_code string

Both routes have backward compat code:
```js
if (!promoCodesArr && promo_code) {
  promoCodesArr = [{ code: promo_code, is_active: true }];
}
```

This converts a single code string into an array of length 1. For Free tier (limit=0), this single code will be rejected. Correct behavior.

### 8f. Existing offers may have promo codes beyond new limits

If a business is downgraded from Standard to Free, their existing offers may have promo codes. Options:

1. **Do nothing** (recommended for MVP): Existing codes remain functional. The limit only applies when creating/editing offers. When editing, if they try to save with existing codes, they will be rejected.
2. **Soft enforcement:** Allow viewing existing codes, but disable adding new ones.
3. **Hard enforcement:** Delete excess codes on downgrade (bad UX, avoid).

**Recommended:** Option 1 for creation, option 2 for editing. On edit, if the business is Free tier and has existing codes, show them as read-only and allow saving without modification. Only reject if they try to ADD codes.

To implement this, the update handler should compare old count vs new count:

```js
// On update: get existing count BEFORE delete
const existingCount = await client.query(
  "SELECT COUNT(*)::int AS cnt FROM promo_codes WHERE offer_id = $1",
  [offerId]
);
const oldCount = existingCount.rows[0].cnt;
const newCount = validCodes.length;

// Only enforce limit if they're adding codes (newCount > oldCount)
// OR always enforce if tier is Free (limit=0, no codes allowed at all)
if (promoLimit === 0 && newCount > 0) {
  // Reject: free tier can't have codes
} else if (promoLimit !== null && newCount > promoLimit && newCount > oldCount) {
  // Reject: exceeding limit with new additions
}
```

### 8g. Flutter offer form

The Flutter offer creation/edit screen should also hide or disable the promo code section based on tier. Fetch the business tier info from `GET /:businessId/subscription` and conditionally render the promo code input widget.

---

## 9. API Response Format

On promo code limit hit, all endpoints return:

```json
{
  "error": "limit_reached",
  "message": "Codurile promoționale nu sunt disponibile pe planul Gratuit.",
  "currentTier": "free",
  "limit": 0,
  "current": 1,
  "limitKey": "max_promo_codes_per_offer"
}
```

Or for Standard tier exceeding:
```json
{
  "error": "limit_reached",
  "message": "Maximum 3 coduri per ofertă pe planul Standard.",
  "currentTier": "standard",
  "limit": 3,
  "current": 5,
  "limitKey": "max_promo_codes_per_offer"
}
```

HTTP status: **403 Forbidden**.

The `limitKey` field helps the frontend distinguish between different limit types (offer limit vs promo code limit vs gallery limit).

---

## 10. Testing Checklist

### Offer creation:
- [ ] Free tier: create offer with 0 promo codes -> succeeds
- [ ] Free tier: create offer with 1 promo code -> 403 `limit_reached`
- [ ] Standard tier: create offer with 3 promo codes -> succeeds
- [ ] Standard tier: create offer with 4 promo codes -> 403 `limit_reached`
- [ ] Premium tier: create offer with 50 promo codes -> succeeds
- [ ] BOTH routes (business-portal.js AND web.js) tested

### Offer update:
- [ ] Free tier: edit offer, remove all promo codes -> succeeds
- [ ] Free tier: edit offer, add 1 promo code -> 403
- [ ] Standard tier: edit offer, change codes but stay at 3 -> succeeds
- [ ] Standard tier: edit offer, go from 3 to 4 -> 403
- [ ] Old backward-compat `promo_code` string param -> correctly converted and checked

### UI:
- [ ] offer-form.ejs: promo section hidden for Free tier
- [ ] offer-form.ejs: promo section shows limit hint for Standard tier
- [ ] offer-form.ejs: no limit shown for Premium tier
- [ ] JavaScript prevents adding more inputs than limit allows
- [ ] manage.ejs: promo code column hidden for Free tier

### Edge cases:
- [ ] Downgraded business: existing codes still visible, cannot add more
- [ ] web.js update wrapped in transaction (no data loss on rejection)
