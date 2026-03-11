# 10 — Competitor Blocking on Business Page

> **Scop:** Premium businesses can prevent competitor offers from appearing in "similar offers" sections on their own offer detail pages.
> **Dependinte:** `00-subscription-foundation.md` (tables + tier helpers + middleware)
> **Fisiere afectate:**
> - `appredueri_backend/src/routes/web.js` — offer detail similar offers query (lines ~777-795), business detail page (no similar section currently)
> - `appredueri_backend/src/routes/offers.js` — mobile similar offers (used by `similarOffersProvider` via `GET /offers?exclude=X&category_id=Y`)
> - `appredueri_backend/src/routes/business-portal.js` — toggle endpoint for the setting
> - `appredueri_backend/src/views/public/portal/manage.ejs` — toggle UI in settings
> - `ofai_flutter/lib/providers/offers_provider.dart` — `similarOffersProvider` (no change needed, just API param)

---

## 1. Where "Similar Offers" Currently Appears

### 1a. Web: Offer Detail Page (web.js lines ~777-795)

The offer detail page (`GET /oferta/:id`) has a "Similar Offers" section. The current query:

```sql
SELECT o.id, o.title, o.discount_type, o.discount_value, o.end_date,
       b.name as business_name, b.logo_url as business_logo,
       COALESCE(o.logo_url, b.cover_image_url) as image_url,
       c2.name as city_name
FROM offers o
JOIN businesses b ON o.business_id = b.id
LEFT JOIN cities c2 ON b.city_id = c2.id
WHERE o.id != $1 AND o.is_active = TRUE
  AND (o.end_date IS NULL OR o.end_date >= CURRENT_DATE)
  AND b.category_id = $2
ORDER BY (SELECT COUNT(*) FROM favorite_offers fo WHERE fo.offer_id = o.id) DESC
LIMIT 4
```

This query shows offers from OTHER businesses in the SAME category. This is where competitor blocking applies.

### 1b. Web: Business Detail Page (web.js lines ~907-1157)

The business detail page (`GET /business/:id`) does NOT have a "similar offers" or "related businesses" section. It only shows the business's OWN offers. **No changes needed here.**

### 1c. Mobile: Similar Offers (offers.js)

The Flutter app uses `similarOffersProvider` which calls `GET /offers?exclude=X&category_id=Y&limit=6&sort=popular`. This is the standard offers listing endpoint, filtered by category and excluding the current offer. Competitor offers appear here because it fetches all offers in the same category.

---

## 2. Implementation: No New Table Needed

The `has_competitor_blocking` boolean on `subscription_plans` is already sufficient. We just need to check the current offer's business subscription at query time.

---

## 3. Web: Offer Detail — Modified Similar Offers Query

**File:** `appredueri_backend/src/routes/web.js`

Replace the similar offers block (lines ~777-795) with:

```js
    // Similar offers (same category, respecting competitor blocking)
    let similarOffers = [];
    if (row.cat_id) {
      try {
        // Check if the current offer's business has competitor blocking enabled
        let blockCompetitors = false;
        try {
          const tierCheck = await pool.query(`
            SELECT splan.has_competitor_blocking
            FROM business_subscriptions bsub
            JOIN subscription_plans splan ON splan.id = bsub.plan_id
            WHERE bsub.business_id = $1
              AND bsub.status IN ('active', 'trial')
            LIMIT 1
          `, [row.business_id]);
          if (tierCheck.rows.length > 0 && tierCheck.rows[0].has_competitor_blocking) {
            blockCompetitors = true;
          }
        } catch (e) { /* fail open — don't block on tier errors */ }

        let simQuery;
        let simParams;

        if (blockCompetitors) {
          // Show only offers from the SAME business (no competitors)
          simQuery = `
            SELECT o.id, o.title, o.discount_type, o.discount_value, o.end_date,
                   b.name as business_name, b.logo_url as business_logo,
                   COALESCE(o.logo_url, b.cover_image_url) as image_url,
                   c2.name as city_name
            FROM offers o
            JOIN businesses b ON o.business_id = b.id
            LEFT JOIN cities c2 ON b.city_id = c2.id
            WHERE o.id != $1 AND o.is_active = TRUE
              AND (o.end_date IS NULL OR o.end_date >= CURRENT_DATE)
              AND o.business_id = $2
            ORDER BY (SELECT COUNT(*) FROM favorite_offers fo WHERE fo.offer_id = o.id) DESC
            LIMIT 4
          `;
          simParams = [id, row.business_id];
        } else {
          // Default: show offers from any business in the same category
          simQuery = `
            SELECT o.id, o.title, o.discount_type, o.discount_value, o.end_date,
                   b.name as business_name, b.logo_url as business_logo,
                   COALESCE(o.logo_url, b.cover_image_url) as image_url,
                   c2.name as city_name
            FROM offers o
            JOIN businesses b ON o.business_id = b.id
            LEFT JOIN cities c2 ON b.city_id = c2.id
            WHERE o.id != $1 AND o.is_active = TRUE
              AND (o.end_date IS NULL OR o.end_date >= CURRENT_DATE)
              AND b.category_id = $2
            ORDER BY (SELECT COUNT(*) FROM favorite_offers fo WHERE fo.offer_id = o.id) DESC
            LIMIT 4
          `;
          simParams = [id, row.cat_id];
        }

        const simResult = await pool.query(simQuery, simParams);
        similarOffers = simResult.rows;
      } catch (e) { /* silently fail */ }
    }
```

**Key change:** When `blockCompetitors = true`, the query filters by `o.business_id = $2` (same business) instead of `b.category_id = $2` (same category). This means the similar offers section shows OTHER offers from the SAME business, not competitor offers.

---

## 4. Mobile: Offers Listing — Competitor Blocking for Similar

**File:** `appredueri_backend/src/routes/offers.js`

The Flutter `similarOffersProvider` calls `GET /offers?exclude=X&category_id=Y&limit=6&sort=popular`. We need to add an optional `block_competitors_for` query param that triggers the blocking logic.

### 4a. Add to offers.js GET `/` endpoint

After the existing filter building (around line ~70), add:

```js
    // Competitor blocking: if block_competitors_for is a business_id,
    // check if that business has competitor blocking enabled
    // and if so, filter to only that business's offers
    if (req.query.block_competitors_for) {
      const blockBizId = parseInt(req.query.block_competitors_for);
      if (!Number.isNaN(blockBizId)) {
        try {
          const tierCheck = await pool.query(`
            SELECT splan.has_competitor_blocking
            FROM business_subscriptions bsub
            JOIN subscription_plans splan ON splan.id = bsub.plan_id
            WHERE bsub.business_id = $1
              AND bsub.status IN ('active', 'trial')
            LIMIT 1
          `, [blockBizId]);

          if (tierCheck.rows.length > 0 && tierCheck.rows[0].has_competitor_blocking) {
            // Override: only show offers from this business
            filters.push(`b.id = $${idx}`);
            values.push(blockBizId);
            idx++;
          }
        } catch (e) { /* fail open */ }
      }
    }
```

### 4b. Flutter: Update `similarOffersProvider`

**File:** `ofai_flutter/lib/providers/offers_provider.dart`

Change the provider to also pass `block_competitors_for`:

```dart
final similarOffersProvider = FutureProvider.autoDispose.family<List<Offer>, ({int offerId, int? categoryId, int? businessId})>((ref, params) async {
  try {
    final response = await ApiClient().dio.get(
      ApiEndpoints.offers,
      queryParameters: {
        'exclude': params.offerId,
        'limit': 6,
        'sort': 'popular',
        if (params.categoryId != null) 'category_id': params.categoryId,
        if (params.businessId != null) 'block_competitors_for': params.businessId,
      },
    );
    final paginated = PaginatedResponse.fromJson(response.data, Offer.fromJson);
    return paginated.data;
  } catch (_) {
    return [];
  }
});
```

### 4c. Update the call site in `offer_detail_screen.dart`

**File:** `ofai_flutter/lib/screens/offer/offer_detail_screen.dart` (line ~537)

Change from:
```dart
final similarAsync = ref.watch(similarOffersProvider((offerId: offer.id, categoryId: offer.business?.categoryId)));
```

To:
```dart
final similarAsync = ref.watch(similarOffersProvider((
  offerId: offer.id,
  categoryId: offer.business?.categoryId,
  businessId: offer.business?.id,
)));
```

The `businessId` is always passed. The backend decides whether to apply blocking based on the business's subscription. This means:
- Free business: `block_competitors_for` is sent but tier check finds no blocking feature, so normal category-based similar offers show.
- Premium business with blocking: tier check succeeds, only same-business offers returned.

---

## 5. Business Portal: Toggle Endpoint

**File:** `appredueri_backend/src/routes/business-portal.js`

This is a READ-ONLY feature flag from `subscription_plans`. There is no per-business toggle to save -- the feature is either enabled (Premium) or not. However, we should allow businesses to **opt out** of competitor blocking even if they have it, in case they WANT competitors to appear (for ecosystem reasons).

### Approach: Add `competitor_blocking_enabled` BOOLEAN to `businesses` table

```sql
-- Add to an existing migration or create 035_competitor_blocking_pref.sql
ALTER TABLE businesses ADD COLUMN IF NOT EXISTS competitor_blocking_enabled BOOLEAN NOT NULL DEFAULT TRUE;
```

This column defaults to TRUE, meaning if a Premium business has `has_competitor_blocking`, it is active by default. They can toggle it off.

### Toggle endpoint:

```js
// Toggle competitor blocking preference
router.put(
  '/:businessId/competitor-blocking',
  businessAuth,
  requireFeature('has_competitor_blocking'),
  async (req, res) => {
    const { businessId } = req.params;
    const { enabled } = req.body;

    if (typeof enabled !== 'boolean') {
      return res.status(400).json({ error: 'enabled trebuie sa fie boolean' });
    }

    try {
      await pool.query(
        'UPDATE businesses SET competitor_blocking_enabled = $1 WHERE id = $2',
        [enabled, businessId]
      );

      res.json({ competitor_blocking_enabled: enabled });
    } catch (err) {
      console.error('[Portal] Competitor blocking toggle error:', err);
      res.status(500).json({ error: 'Eroare server' });
    }
  }
);
```

### Update the blocking checks in web.js and offers.js

In step 3 and step 4, after checking `splan.has_competitor_blocking`, also check the business preference:

```js
        const tierCheck = await pool.query(`
          SELECT splan.has_competitor_blocking, b.competitor_blocking_enabled
          FROM business_subscriptions bsub
          JOIN subscription_plans splan ON splan.id = bsub.plan_id
          JOIN businesses b ON b.id = bsub.business_id
          WHERE bsub.business_id = $1
            AND bsub.status IN ('active', 'trial')
          LIMIT 1
        `, [businessId]);
        if (tierCheck.rows.length > 0
            && tierCheck.rows[0].has_competitor_blocking
            && tierCheck.rows[0].competitor_blocking_enabled) {
          blockCompetitors = true;
        }
```

---

## 6. manage.ejs: Toggle UI

**File:** `appredueri_backend/src/views/public/portal/manage.ejs`

### 6a. Pass data to template

In the `GET /:businessId/manage` route in `business-portal.js`, include:

```js
      competitorBlockingEnabled: business.competitor_blocking_enabled,
      // tier is already passed from attachTier middleware
```

### 6b. Add toggle in the "Info" tab (or a dedicated "Setari" tab)

Add after existing info fields, inside `tab-info`, within a Premium-gated section:

```ejs
      <% if (tier && tier.plan && tier.plan.has_competitor_blocking) { %>
      <div class="glass-card" style="margin-top: 24px;">
        <div style="display: flex; align-items: center; justify-content: space-between; gap: 16px;">
          <div>
            <div style="font-weight: 600; color: var(--text-primary); margin-bottom: 4px;">
              Blocheaza ofertele competitorilor
            </div>
            <div style="font-size: 0.8125rem; color: var(--text-secondary);">
              Impiedica afisarea ofertelor altor business-uri din aceeasi categorie pe paginile ofertelor tale.
            </div>
          </div>
          <button class="toggle-btn <%= competitorBlockingEnabled !== false ? 'on' : 'off' %>"
                  id="competitor-blocking-toggle"
                  onclick="toggleCompetitorBlocking(this)"
                  title="<%= competitorBlockingEnabled !== false ? 'Activ' : 'Inactiv' %>"></button>
        </div>
      </div>
      <% } %>
```

### 6c. JavaScript handler

Add to the script section:

```js
  window.toggleCompetitorBlocking = async function(btn) {
    var isOn = btn.classList.contains('on');
    var newValue = !isOn;

    try {
      var res = await apiFetch('/api/web/portal/' + businessId + '/competitor-blocking', {
        method: 'PUT',
        body: JSON.stringify({ enabled: newValue }),
      });

      if (res.ok) {
        btn.classList.toggle('on');
        btn.classList.toggle('off');
        showToast(newValue ? 'Blocare competitori activata' : 'Blocare competitori dezactivata', 'success');
      } else {
        var data = await res.json();
        showToast(data.error || 'Eroare', 'error');
      }
    } catch (e) {
      showToast('Eroare de retea', 'error');
    }
  };
```

---

## 7. Migration: `035_competitor_blocking_pref.sql`

```sql
-- Business preference for competitor blocking (opt-out capability)
ALTER TABLE businesses
  ADD COLUMN IF NOT EXISTS competitor_blocking_enabled BOOLEAN NOT NULL DEFAULT TRUE;

-- No index needed — this column is only read when checking a specific business_id
-- which already uses the PK index
```

---

## 8. Scope Clarification

Competitor blocking ONLY affects:
- **Offer detail page** — the "Oferte similare" section at the bottom
- **Mobile offer detail** — the similar offers fetched by `similarOffersProvider`

Competitor blocking does NOT affect:
- **Search results** — all businesses appear in search regardless of blocking
- **Homepage** — featured/promoted/deal sections are unaffected
- **Businesses listing page** — competitor businesses still appear
- **Business detail page** — already only shows that business's offers, no competitors shown

---

## 9. Gotchas

### 9a. Empty similar offers section
When blocking is active and the business has no OTHER offers (only the current one), the similar offers section will be empty. This is acceptable -- an empty state is better than showing competitors. The existing `<% if (similarOffers.length > 0) %>` check in `offer-detail.ejs` handles this gracefully.

### 9b. Business downgrades from Premium
The `has_competitor_blocking` check happens at query time. If a business downgrades, the tier check fails and blocking is automatically disabled. The `competitor_blocking_enabled` preference remains in the DB but has no effect. If they re-upgrade, blocking resumes automatically.

### 9c. `block_competitors_for` parameter abuse
A malicious user could call `GET /offers?block_competitors_for=123` to see if business 123 has competitor blocking enabled (empty vs populated results). This is low-risk information leakage. If needed, restrict the param to authenticated users, but it is not worth the complexity for now.

### 9d. Performance
The tier check is one additional query per offer detail page load. This is negligible. The check is NOT in a loop -- it runs once per page load.

### 9e. Similar offers section label
When competitor blocking is active, the "Oferte similare" heading still makes sense because we show OTHER offers from the SAME business (which are similar in the sense of same brand). No label change needed.

### 9f. `competitor_blocking_enabled` default
The column defaults to TRUE, meaning newly upgraded Premium businesses get blocking automatically. This is the expected behavior -- they can opt out via the toggle.

---

## 10. Verification Checklist

- [ ] Migration `035_competitor_blocking_pref.sql` runs successfully
- [ ] Premium business with blocking enabled: offer detail shows only same-business offers in "similar"
- [ ] Premium business with blocking disabled: offer detail shows category-wide offers
- [ ] Free business: offer detail shows category-wide offers (unchanged behavior)
- [ ] Standard business: same as free (no `has_competitor_blocking`)
- [ ] Toggle endpoint works: PUT returns correct state
- [ ] Toggle UI in manage.ejs: visible only for Premium, toggles correctly
- [ ] Toggle hidden for Free/Standard businesses
- [ ] Mobile: `block_competitors_for` param applied correctly
- [ ] Mobile: similar offers section respects blocking
- [ ] Empty similar offers when blocking active + no other offers: graceful empty state
- [ ] Search results NOT affected by blocking
- [ ] Homepage NOT affected by blocking
- [ ] Business detail page NOT affected (was already correct)
- [ ] Downgraded business: blocking automatically disabled
