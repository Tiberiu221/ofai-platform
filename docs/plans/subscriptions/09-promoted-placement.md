# 09 — Promoted Placement (Homepage + Search)

> **Scop:** Premium businesses get boosted placement in search results and a dedicated "Oferte Promovate" section on the homepage.
> **Dependinte:** `00-subscription-foundation.md` (tables + tier helpers + middleware)
> **Fisiere afectate:**
> - `appredueri_backend/src/routes/web.js` — homepage (featured offers query ~158-180, top businesses ~199-215), offers page (listing query ~393-416), businesses page (listing query ~579-596)
> - `appredueri_backend/src/routes/offers.js` — mobile offers listing (query ~81-132)
> - `appredueri_backend/src/routes/businesses.js` — mobile businesses listing (query ~86-127)
> - `appredueri_backend/src/views/public/home.ejs` — new "Oferte Promovate" section
> - `appredueri_backend/src/views/public/oferte.ejs` — "Promovat" badge on cards
> - `appredueri_backend/src/views/public/business-uri.ejs` — "Promovat" badge on cards
> - `ofai_flutter/lib/models/offer.dart` — add `isPromoted` field
> - `ofai_flutter/lib/models/business.dart` — add `isPromoted` field
> - `ofai_flutter/lib/widgets/offer_card.dart` — display badge
> - `ofai_flutter/lib/screens/home/home_screen.dart` — "Oferte Promovate" section

---

## 1. SQL Boost Strategy

The boost is a **small additive term** in the ORDER BY score that gives Premium/Standard businesses a gentle advantage without dominating relevance signals.

### Reusable SQL fragment (tier boost)

This LEFT JOIN + CASE pattern is used in ALL affected queries:

```sql
LEFT JOIN business_subscriptions bsub
  ON bsub.business_id = b.id AND bsub.status IN ('active', 'trial')
LEFT JOIN subscription_plans splan
  ON splan.id = bsub.plan_id
```

Boost expression for offers ranking:
```sql
CASE
  WHEN splan.slug = 'premium' THEN 0.4
  WHEN splan.slug = 'standard' THEN 0.1
  ELSE 0
END
```

Boost expression for businesses ranking (higher because business score is integer-ranged):
```sql
CASE
  WHEN splan.slug = 'premium' THEN 3
  WHEN splan.slug = 'standard' THEN 1
  ELSE 0
END
```

`isPromoted` SELECT field (for badge display):
```sql
COALESCE(splan.has_promoted_placement, FALSE) as is_promoted
```

---

## 2. Web: Homepage Featured Offers (web.js ~158-180)

**File:** `appredueri_backend/src/routes/web.js`

### Current query (line ~158-180):
```sql
SELECT o.id, o.title, ... FROM offers o
JOIN businesses b ON o.business_id = b.id
LEFT JOIN cities ci ON b.city_id = ci.id
LEFT JOIN categories cat ON b.category_id = cat.id
LEFT JOIN reviews r ON r.business_id = b.id
WHERE ...
GROUP BY ...
ORDER BY (RANDOM() * 0.4 + LEAST(o.discount_value, 100) / 100.0 * 0.3 + CASE WHEN o.end_date <= CURRENT_DATE + INTERVAL '3 days' THEN 0.3 ELSE 0.1 END) DESC
LIMIT 6
```

### Modified query:

Add after the existing JOINs (after `LEFT JOIN reviews r`):
```sql
LEFT JOIN business_subscriptions bsub
  ON bsub.business_id = b.id AND bsub.status IN ('active', 'trial')
LEFT JOIN subscription_plans splan
  ON splan.id = bsub.plan_id
```

Add to SELECT:
```sql
COALESCE(splan.has_promoted_placement, FALSE) as is_promoted
```

Add `splan.slug, splan.has_promoted_placement` to the GROUP BY.

Change ORDER BY to:
```sql
ORDER BY (
  RANDOM() * 0.4
  + LEAST(o.discount_value, 100) / 100.0 * 0.3
  + CASE WHEN o.end_date <= CURRENT_DATE + INTERVAL '3 days' THEN 0.3 ELSE 0.1 END
  + CASE WHEN splan.slug = 'premium' THEN 0.4 WHEN splan.slug = 'standard' THEN 0.1 ELSE 0 END
) DESC
```

---

## 3. Web: Homepage "Oferte Promovate" Section

### 3a. New query in web.js home route (add after featured offers query, ~line 181)

```js
    // Promoted offers (dedicated section for Premium businesses)
    let promotedOffers = [];
    try {
      const promotedResult = await pool.query(`
        SELECT o.id, o.title, o.discount_type, o.discount_value, o.end_date,
               b.name as business_name, b.logo_url as business_logo,
               b.cover_image_url as business_cover,
               b.lat as business_lat, b.lng as business_lng,
               ci.name as city_name, cat.name as category_name,
               COALESCE(b.cover_image_url, o.logo_url) as image_url,
               COALESCE(AVG(r.rating), 0) as rating_avg,
               COUNT(DISTINCT r.id) as rating_count,
               (SELECT COUNT(*) FROM favorite_offers fo WHERE fo.offer_id = o.id) as favorite_count
        FROM offers o
        JOIN businesses b ON o.business_id = b.id
        JOIN business_subscriptions bsub
          ON bsub.business_id = b.id AND bsub.status IN ('active', 'trial')
        JOIN subscription_plans splan
          ON splan.id = bsub.plan_id AND splan.has_promoted_placement = TRUE
        LEFT JOIN cities ci ON b.city_id = ci.id
        LEFT JOIN categories cat ON b.category_id = cat.id
        LEFT JOIN reviews r ON r.business_id = b.id
        WHERE o.is_active = TRUE AND o.end_date >= CURRENT_DATE
          ${dealOfDay ? `AND o.id != ${parseInt(dealOfDay.id)}` : ''}
        GROUP BY o.id, o.title, o.discount_type, o.discount_value, o.end_date,
                 b.name, b.logo_url, b.cover_image_url, b.lat, b.lng,
                 ci.name, cat.name, o.logo_url
        ORDER BY RANDOM()
        LIMIT 3
      `);
      promotedOffers = promotedResult.rows;
    } catch (e) { /* promoted section is non-critical */ }
```

Add `promotedOffers` to the `res.render('public/home', { ... })` call:
```js
      promotedOffers,
```

### 3b. home.ejs — New section

Add after the featured offers section and before the categories section. Use the same card pattern as featured offers:

```ejs
    <% if (promotedOffers && promotedOffers.length > 0) { %>
    <section class="section" id="promoted-section">
      <div class="container">
        <div class="section-header">
          <h2 class="section-title">Oferte Promovate</h2>
          <p class="section-subtitle">De la business-urile noastre partenere</p>
        </div>
        <div class="offers-grid promoted-grid">
          <% promotedOffers.forEach(function(offer) { %>
            <%- include('partials/offer-card', { offer: offer, isPromoted: true, userFavoriteIds: userFavoriteIds }) %>
          <% }); %>
        </div>
      </div>
    </section>
    <% } %>
```

**Note:** If the project does NOT use a shared offer-card partial, inline the card HTML directly, matching the exact structure used in the featured offers grid. Add a `promoted-badge` element inside the card:

```html
<span class="promoted-badge">Promovat</span>
```

### 3c. CSS for promoted badge (add to the page or global styles)

```css
.promoted-badge {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 3px 10px;
  border-radius: 9999px;
  background: linear-gradient(135deg, rgba(251,146,60,0.15), rgba(251,146,60,0.08));
  border: 1px solid rgba(251,146,60,0.25);
  color: #fb923c;
  font-size: 0.7rem;
  font-weight: 600;
  letter-spacing: 0.02em;
  text-transform: uppercase;
  position: absolute;
  top: 10px;
  left: 10px;
  z-index: 2;
  backdrop-filter: blur(8px);
}
```

---

## 4. Web: Offers Page Listing (web.js ~393-416)

**File:** `appredueri_backend/src/routes/web.js`

### Current query structure:
```sql
SELECT o.id, o.title, ...
FROM offers o
JOIN businesses b ON o.business_id = b.id
LEFT JOIN cities ci ON b.city_id = ci.id
LEFT JOIN categories cat ON b.category_id = cat.id
LEFT JOIN reviews r ON r.business_id = b.id
WHERE ...
GROUP BY ...
ORDER BY ${orderBy}
```

### Changes:

1. Add JOINs after `LEFT JOIN reviews r`:
```sql
LEFT JOIN business_subscriptions bsub
  ON bsub.business_id = b.id AND bsub.status IN ('active', 'trial')
LEFT JOIN subscription_plans splan
  ON splan.id = bsub.plan_id
```

2. Add to SELECT:
```sql
COALESCE(splan.has_promoted_placement, FALSE) as is_promoted
```

3. Add `splan.slug, splan.has_promoted_placement` to GROUP BY.

4. **Only boost the default/popular sort** (do NOT affect "newest", "discount", "ending_soon" sorts as those have explicit user-chosen criteria):

```js
    const sortOptions = {
      newest: "o.id DESC",
      popular: `(COALESCE(AVG(r.rating), 0) + CASE WHEN splan.slug = 'premium' THEN 0.4 WHEN splan.slug = 'standard' THEN 0.1 ELSE 0 END) DESC, COUNT(DISTINCT r.id) DESC`,
      discount: "CASE WHEN o.discount_type IN ('percent','percentage') THEN o.discount_value ELSE 0 END DESC, o.discount_value DESC",
      ending_soon: "o.end_date ASC NULLS LAST, o.id DESC",
    };
```

5. Pass `is_promoted` through to the template for badge rendering.

---

## 5. Web: Businesses Page Listing (web.js ~579-596)

**File:** `appredueri_backend/src/routes/web.js`

### Current query:
```sql
SELECT b.id, b.name, ... COUNT(DISTINCT o.id) as offer_count
FROM businesses b
LEFT JOIN cities ci ON ...
LEFT JOIN categories cat ON ...
LEFT JOIN reviews r ON ...
LEFT JOIN offers o ON ...
GROUP BY ...
ORDER BY ${orderBy}
```

### Changes:

1. Add JOINs after existing LEFT JOINs:
```sql
LEFT JOIN business_subscriptions bsub
  ON bsub.business_id = b.id AND bsub.status IN ('active', 'trial')
LEFT JOIN subscription_plans splan
  ON splan.id = bsub.plan_id
```

2. Add to SELECT:
```sql
COALESCE(splan.has_promoted_placement, FALSE) as is_promoted
```

3. Add `splan.slug, splan.has_promoted_placement` to GROUP BY.

4. Modify the `popular` sort option (currently default):
```js
    const sortOptions = {
      popular: `(COUNT(DISTINCT o.id) + RANDOM() * 2 + CASE WHEN splan.slug = 'premium' THEN 3 WHEN splan.slug = 'standard' THEN 1 ELSE 0 END) DESC, COALESCE(AVG(r.rating), 0) DESC`,
      rating: "COALESCE(AVG(r.rating), 0) DESC, COUNT(DISTINCT r.id) DESC",
      newest: "b.id DESC",
      offers: "COUNT(DISTINCT o.id) DESC, b.id DESC",
    };
```

---

## 6. Web: Homepage Top Businesses (web.js ~199-215)

### Current query:
```sql
SELECT b.id, b.name, ... COUNT(DISTINCT o.id) as offer_count
FROM businesses b
...
ORDER BY (COUNT(DISTINCT o.id) + RANDOM() * 2) DESC, COALESCE(AVG(r.rating), 0) DESC
```

### Changes:

Add the same bsub/splan JOINs and modify ORDER BY:
```sql
LEFT JOIN business_subscriptions bsub
  ON bsub.business_id = b.id AND bsub.status IN ('active', 'trial')
LEFT JOIN subscription_plans splan
  ON splan.id = bsub.plan_id
...
ORDER BY (COUNT(DISTINCT o.id) + RANDOM() * 2 + CASE WHEN splan.slug = 'premium' THEN 3 WHEN splan.slug = 'standard' THEN 1 ELSE 0 END) DESC, COALESCE(AVG(r.rating), 0) DESC
```

Add `splan.slug` to GROUP BY.

---

## 7. Mobile API: Offers Listing (offers.js ~81-132)

**File:** `appredueri_backend/src/routes/offers.js`

### Current query structure:
```sql
SELECT o.id, o.title, ...
FROM offers o
JOIN businesses b ON o.business_id = b.id
LEFT JOIN cities c ON b.city_id = c.id
LEFT JOIN categories cat ON b.category_id = cat.id
LEFT JOIN LATERAL (...) locs ON true
WHERE ...
ORDER BY ${orderBy}
```

### Changes:

1. Add JOINs after `LEFT JOIN categories cat`:
```sql
LEFT JOIN business_subscriptions bsub
  ON bsub.business_id = b.id AND bsub.status IN ('active', 'trial')
LEFT JOIN subscription_plans splan
  ON splan.id = bsub.plan_id
```

2. Add to SELECT:
```sql
COALESCE(splan.has_promoted_placement, FALSE) as is_promoted
```

3. Modify the `popular` sort option:
```js
    if (sort === "popular") orderBy = `(
      (SELECT COALESCE(AVG(rating), 0) FROM reviews WHERE business_id = b.id)
      + CASE WHEN splan.slug = 'premium' THEN 0.4 WHEN splan.slug = 'standard' THEN 0.1 ELSE 0 END
    ) DESC NULLS LAST, o.id DESC`;
```

**Important:** The default sort (`o.id DESC` = newest) should NOT be boosted. Only the `popular` sort gets a boost.

4. Include `is_promoted` in the response mapping (around line ~155):
```js
      is_promoted: row.is_promoted || false,
```

---

## 8. Mobile API: Businesses Listing (businesses.js ~86-127)

**File:** `appredueri_backend/src/routes/businesses.js`

### Current query:
```sql
SELECT b.id, b.name, ...
FROM businesses b
JOIN cities c ON ...
JOIN categories cat ON ...
LEFT JOIN (...) o ON ...
LEFT JOIN (...) r ON ...
ORDER BY c.name, cat.name, b.name
```

### Changes:

1. Add JOINs:
```sql
LEFT JOIN business_subscriptions bsub
  ON bsub.business_id = b.id AND bsub.status IN ('active', 'trial')
LEFT JOIN subscription_plans splan
  ON splan.id = bsub.plan_id
```

2. Add to SELECT:
```sql
COALESCE(splan.has_promoted_placement, FALSE) as is_promoted
```

3. The current ORDER BY is `c.name, cat.name, b.name` (alphabetical). Add a promoted-first tiebreak:
```sql
ORDER BY
  CASE WHEN splan.has_promoted_placement = TRUE THEN 0 ELSE 1 END,
  c.name, cat.name, b.name
```

4. Include in response mapping:
```js
      is_promoted: row.is_promoted || false,
```

---

## 9. Flutter: Model Changes

### 9a. `ofai_flutter/lib/models/offer.dart`

Add field:
```dart
  final bool isPromoted;
```

In the constructor, add with default:
```dart
  this.isPromoted = false,
```

In `fromJson`:
```dart
  isPromoted: json['is_promoted'] == true,
```

### 9b. `ofai_flutter/lib/models/business.dart`

Add field:
```dart
  final bool isPromoted;
```

In the constructor:
```dart
  this.isPromoted = false,
```

In `fromJson`:
```dart
  isPromoted: json['is_promoted'] == true,
```

---

## 10. Flutter: Badge Display

### 10a. `ofai_flutter/lib/widgets/offer_card.dart`

Add a "Promovat" badge in the card's Stack (near the top-left), conditionally:

```dart
if (offer.isPromoted)
  Positioned(
    top: 8,
    left: 8,
    child: Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
      decoration: BoxDecoration(
        color: AppColors.accent.withOpacity(0.15),
        borderRadius: BorderRadius.circular(99),
        border: Border.all(color: AppColors.accent.withOpacity(0.3)),
      ),
      child: Text(
        'PROMOVAT',
        style: TextStyle(
          color: AppColors.accent,
          fontSize: 10,
          fontWeight: FontWeight.w600,
          letterSpacing: 0.5,
        ),
      ),
    ),
  ),
```

### 10b. Flutter Home Screen — "Oferte Promovate" Section

**File:** `ofai_flutter/lib/screens/home/home_screen.dart`

Add a new provider to fetch promoted offers:

**File:** `ofai_flutter/lib/providers/offers_provider.dart`

```dart
final promotedOffersProvider = FutureProvider.autoDispose<List<Offer>>((ref) async {
  // Fetch offers that are promoted (from Premium businesses)
  // Use a custom query param or rely on the API returning is_promoted
  final response = await ApiClient().dio.get(
    ApiEndpoints.offers,
    queryParameters: {
      'limit': 3,
      'sort': 'popular',
      'promoted_only': '1', // see backend note below
    },
  );
  final paginated = PaginatedResponse.fromJson(response.data, Offer.fromJson);
  return paginated.data.where((o) => o.isPromoted).take(3).toList();
});
```

**Backend support needed:** Add `promoted_only=1` filter to `offers.js` GET `/`:

```js
    // Filter to promoted offers only
    if (req.query.promoted_only === '1') {
      filters.push(`splan.has_promoted_placement = TRUE`);
    }
```

Then in `home_screen.dart`, add a section between featured offers and categories:

```dart
// Promoted Offers Section
Consumer(
  builder: (context, ref, _) {
    final promotedAsync = ref.watch(promotedOffersProvider);
    return promotedAsync.when(
      data: (promoted) {
        if (promoted.isEmpty) return const SizedBox.shrink();
        return Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const SizedBox(height: AppSpacing.lg),
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: AppSpacing.md),
              child: Text('Oferte Promovate', style: AppTypography.headlineSmall),
            ),
            const SizedBox(height: AppSpacing.sm),
            SizedBox(
              height: 200,
              child: ListView.separated(
                scrollDirection: Axis.horizontal,
                padding: const EdgeInsets.symmetric(horizontal: AppSpacing.md),
                itemCount: promoted.length,
                separatorBuilder: (_, __) => const SizedBox(width: AppSpacing.sm),
                itemBuilder: (_, i) => SizedBox(
                  width: 280,
                  child: OfferCard(offer: promoted[i]),
                ),
              ),
            ),
          ],
        );
      },
      loading: () => const SizedBox.shrink(), // Don't show skeleton for optional section
      error: (_, __) => const SizedBox.shrink(),
    );
  },
),
```

---

## 11. Performance Considerations

### 11a. JOIN cost
The `business_subscriptions` and `subscription_plans` tables are small (one row per business, 3 rows for plans). The LEFT JOIN adds negligible cost. The unique index `idx_business_subscriptions_active` ensures a fast lookup.

### 11b. Index recommendations
The existing `idx_business_subscriptions_active` index on `(business_id) WHERE status IN ('active', 'trial')` is sufficient. No new indexes needed.

### 11c. COUNT query impact
The count queries (for pagination) do NOT include the subscription JOINs since they only count rows, not sort them. Do NOT add the bsub/splan JOINs to count queries.

### 11d. Cache considerations
If query performance becomes an issue (unlikely with <10K businesses), consider:
- Materializing a `promoted_business_ids` set in memory (similar to plans cache in `tiers.js`)
- Refreshing every 5 minutes
- Using `b.id = ANY($promoted_ids)` instead of JOINs

This is a future optimization, not needed for initial implementation.

---

## 12. Gotchas

1. **GROUP BY pollution:** Adding `splan.slug` and `splan.has_promoted_placement` to GROUP BY is required for PostgreSQL strict mode. Do NOT forget to add these or the query will fail with `column must appear in the GROUP BY clause`.

2. **NULL handling:** Businesses without a subscription (shouldn't happen after migration 033, but belt-and-suspenders) get NULL for `splan.slug`. The `CASE WHEN ... ELSE 0 END` handles this. The `COALESCE(splan.has_promoted_placement, FALSE)` handles the badge.

3. **Zero Premium businesses:** When no businesses have `has_promoted_placement = TRUE`, the promoted section query returns empty. The home.ejs section is wrapped in `<% if (promotedOffers.length > 0) %>`, so nothing renders. The Flutter section returns `SizedBox.shrink()`. No visual artifacts.

4. **Sort override:** ONLY boost the `popular` (default) sort. Do NOT add boost to `newest`, `discount`, or `ending_soon` sorts -- those are explicit user choices and boosting would violate user expectations. The user chose to sort by date/discount/urgency, not relevance.

5. **Interleaving:** The offers page interleaving logic (lines ~418-432 in web.js) runs AFTER the ORDER BY. The boost ensures promoted offers appear earlier in the raw results, and interleaving then separates same-business offers. This is fine -- promoted offers still get better initial positions.

6. **Offer-detail page similar offers:** Do NOT add boost to similar offers queries. Those are relevance-based (same category) and boosting would be inappropriate. Similar offers are not a "listing" -- they are recommendations.

---

## 13. Verification Checklist

- [ ] Homepage featured offers show mild Premium boost (verify with 1 Premium + several free businesses)
- [ ] "Oferte Promovate" section appears on homepage when Premium offers exist
- [ ] "Oferte Promovate" section hidden when no Premium offers
- [ ] Offers page: `popular` sort shows Premium offers higher
- [ ] Offers page: `newest`/`discount`/`ending_soon` sorts are NOT affected
- [ ] Businesses page: `popular` sort shows Premium businesses higher
- [ ] "Promovat" badge appears on promoted offer/business cards
- [ ] Mobile API: `is_promoted` field returned in offer/business responses
- [ ] Mobile API: `promoted_only=1` filter works
- [ ] Flutter: badge renders on promoted offer cards
- [ ] Flutter: "Oferte Promovate" section on home screen
- [ ] Free tier businesses still appear in all listings (just ranked lower)
- [ ] COUNT queries (pagination) not affected by new JOINs
- [ ] All GROUP BY clauses include new columns
