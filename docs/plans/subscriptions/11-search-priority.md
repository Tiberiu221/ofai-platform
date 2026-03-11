# 11 — Search Priority Boost

> **Scop:** Premium businesses rank higher in search results across all listing endpoints.
> **Dependinte:** `00-subscription-foundation.md` (tables + tier helpers + middleware)
> **Fisiere afectate:**
> - `appredueri_backend/src/routes/web.js` — offers page (lines ~383-416), businesses page (lines ~571-596)
> - `appredueri_backend/src/routes/offers.js` — mobile offers listing (lines ~81-132)
> - `appredueri_backend/src/routes/businesses.js` — mobile businesses listing (lines ~86-127)
>
> **Relationship to Plan 09:** This plan overlaps with `09-promoted-placement.md` in the queries it modifies. The difference:
> - Plan 09 adds `is_promoted` SELECT field + the homepage "Oferte Promovate" section + promoted badge
> - Plan 11 focuses exclusively on the ORDER BY boost in search/listing queries
> - If implementing both: apply all JOIN/SELECT/ORDER changes from BOTH plans in a single pass. Do NOT modify the same query twice.
> - **Recommended:** Implement 09 and 11 together in the same session to avoid merge conflicts.

---

## 1. Current Ranking Formulas

### 1a. Web: Featured Offers on Homepage (web.js ~178)

```sql
ORDER BY (
  RANDOM() * 0.4
  + LEAST(o.discount_value, 100) / 100.0 * 0.3
  + CASE WHEN o.end_date <= CURRENT_DATE + INTERVAL '3 days' THEN 0.3 ELSE 0.1 END
) DESC
```

Score range: approximately 0.0 to 1.0 (RANDOM contributes 0-0.4, discount 0-0.3, urgency 0.1-0.3).

### 1b. Web: Offers Page — Popular Sort (web.js ~386)

```js
popular: "rating_avg DESC, rating_count DESC",
```

This is a simple column sort, not a composite score.

### 1c. Web: Businesses Page — Popular Sort (web.js ~572-577)

```js
popular: "offer_count DESC, rating_avg DESC",
```

Where `offer_count` is `COUNT(DISTINCT o.id)`.

### 1d. Web: Top Businesses on Homepage (web.js ~213)

```sql
ORDER BY (COUNT(DISTINCT o.id) + RANDOM() * 2) DESC, COALESCE(AVG(r.rating), 0) DESC
```

Score range: integer-scale (offer_count + random 0-2).

### 1e. Mobile: Offers Listing (offers.js ~74-78)

```js
if (sort === "discount_desc") orderBy = "o.discount_value DESC";
if (sort === "ending_soon") orderBy = "o.end_date ASC";
if (sort === "popular") orderBy = "rating_avg DESC NULLS LAST, o.id DESC";
// default: "o.id DESC"
```

### 1f. Mobile: Businesses Listing (businesses.js ~125)

```sql
ORDER BY c.name, cat.name, b.name
```

---

## 2. Boost Strategy

The tier boost must be:
- **Additive, not multiplicative** — so free-tier businesses with great metrics still outrank Premium businesses with poor metrics
- **Proportional to existing score ranges** — a +0.4 boost on a 0-1 scale is significant but not dominant; a +3 boost on an integer scale is proportionally similar
- **Only applied to relevance-based sorts** — NEVER applied to `newest` (o.id DESC), `discount` (o.discount_value DESC), or `ending_soon` (o.end_date ASC)

### Boost values by tier:

| Context | Premium Boost | Standard Boost | Free |
|---------|:---:|:---:|:---:|
| Offer composite scores (0-1 range) | +0.4 | +0.1 | 0 |
| Business integer scores (offer_count range) | +3 | +1 | 0 |
| Rating-based sorts | +0.4 to rating_avg | +0.1 to rating_avg | 0 |

### SQL CASE expression (reusable):

For offer-scale (0-1):
```sql
CASE
  WHEN splan.slug = 'premium' THEN 0.4
  WHEN splan.slug = 'standard' THEN 0.1
  ELSE 0
END
```

For business-scale (integer):
```sql
CASE
  WHEN splan.slug = 'premium' THEN 3
  WHEN splan.slug = 'standard' THEN 1
  ELSE 0
END
```

---

## 3. Required JOINs (add to ALL affected queries)

After existing JOINs on businesses table, add:

```sql
LEFT JOIN business_subscriptions bsub
  ON bsub.business_id = b.id AND bsub.status IN ('active', 'trial')
LEFT JOIN subscription_plans splan
  ON splan.id = bsub.plan_id
```

**GROUP BY:** Add `splan.slug` to all GROUP BY clauses that use aggregate functions.

---

## 4. Web: Offers Page (web.js ~383-416)

**File:** `appredueri_backend/src/routes/web.js`

### 4a. Add JOINs

After `LEFT JOIN reviews r ON r.business_id = b.id` (around line ~408), add the bsub + splan JOINs.

### 4b. Update GROUP BY

Add `splan.slug` to the GROUP BY clause (line ~410-412).

### 4c. Modify sortOptions (line ~383-389)

```js
    const sortOptions = {
      newest: "o.id DESC",                    // UNCHANGED — explicit user choice
      popular: `(
        COALESCE(AVG(r.rating), 0)
        + CASE WHEN splan.slug = 'premium' THEN 0.4 WHEN splan.slug = 'standard' THEN 0.1 ELSE 0 END
      ) DESC, COUNT(DISTINCT r.id) DESC`,
      discount: "CASE WHEN o.discount_type IN ('percent','percentage') THEN o.discount_value ELSE 0 END DESC, o.discount_value DESC",  // UNCHANGED
      ending_soon: "o.end_date ASC NULLS LAST, o.id DESC",  // UNCHANGED
    };
```

**Rationale:** Only `popular` sort gets a boost. The boost turns the simple `rating_avg DESC` into a composite score `(rating_avg + tier_boost) DESC`. This means a Premium business with 4.0 rating ranks like a 4.4, and a Standard with 4.0 ranks like 4.1. A free business with 4.5 still outranks a Premium with 3.5 (4.5 > 3.5 + 0.4 = 3.9).

---

## 5. Web: Businesses Page (web.js ~571-596)

**File:** `appredueri_backend/src/routes/web.js`

### 5a. Add JOINs

After `LEFT JOIN offers o ON ...` (around line ~590), add the bsub + splan JOINs.

### 5b. Update GROUP BY (line ~592)

Add `splan.slug` to the GROUP BY.

### 5c. Modify sortOptions (line ~571-577)

```js
    const sortOptions = {
      popular: `(
        COUNT(DISTINCT o.id)
        + RANDOM() * 2
        + CASE WHEN splan.slug = 'premium' THEN 3 WHEN splan.slug = 'standard' THEN 1 ELSE 0 END
      ) DESC, COALESCE(AVG(r.rating), 0) DESC`,
      rating: "COALESCE(AVG(r.rating), 0) DESC, COUNT(DISTINCT r.id) DESC",  // UNCHANGED — explicit user choice
      newest: "b.id DESC",             // UNCHANGED
      offers: "COUNT(DISTINCT o.id) DESC, b.id DESC",  // UNCHANGED
    };
```

**Note:** `rating` sort is NOT boosted. When a user explicitly sorts by rating, they want to see the highest-rated businesses, not the highest-paying ones. Only `popular` (the default) gets a boost.

---

## 6. Web: Homepage Featured Offers (web.js ~178)

**File:** `appredueri_backend/src/routes/web.js`

### 6a. Add JOINs

After `LEFT JOIN reviews r ON r.business_id = b.id` (around line ~173), add bsub + splan JOINs.

### 6b. Update GROUP BY (line ~175-177)

Add `splan.slug` to the GROUP BY.

### 6c. Modify ORDER BY (line ~178)

```sql
ORDER BY (
  RANDOM() * 0.4
  + LEAST(o.discount_value, 100) / 100.0 * 0.3
  + CASE WHEN o.end_date <= CURRENT_DATE + INTERVAL '3 days' THEN 0.3 ELSE 0.1 END
  + CASE WHEN splan.slug = 'premium' THEN 0.4 WHEN splan.slug = 'standard' THEN 0.1 ELSE 0 END
) DESC
```

New total score range: 0.0 to 1.4 (was 0.0 to 1.0). Premium boost is ~28% of max.

---

## 7. Web: Homepage Top Businesses (web.js ~213)

**File:** `appredueri_backend/src/routes/web.js`

### 7a. Add JOINs

After existing JOINs (before GROUP BY), add bsub + splan JOINs.

### 7b. Update GROUP BY

Add `splan.slug`.

### 7c. Modify ORDER BY

```sql
ORDER BY (
  COUNT(DISTINCT o.id)
  + RANDOM() * 2
  + CASE WHEN splan.slug = 'premium' THEN 3 WHEN splan.slug = 'standard' THEN 1 ELSE 0 END
) DESC, COALESCE(AVG(r.rating), 0) DESC
```

---

## 8. Mobile: Offers Listing (offers.js ~74-78)

**File:** `appredueri_backend/src/routes/offers.js`

### 8a. Add JOINs

After `LEFT JOIN categories cat ON b.category_id = cat.id` (around line ~104), add bsub + splan JOINs.

### 8b. Modify sort logic (line ~74-78)

```js
    let orderBy = "o.id DESC";  // default: newest — NO boost
    if (sort === "discount_desc") orderBy = "o.discount_value DESC";  // NO boost
    if (sort === "ending_soon") orderBy = "o.end_date ASC";  // NO boost
    if (sort === "popular") orderBy = `(
      (SELECT COALESCE(AVG(rating), 0) FROM reviews WHERE business_id = b.id)
      + CASE WHEN splan.slug = 'premium' THEN 0.4 WHEN splan.slug = 'standard' THEN 0.1 ELSE 0 END
    ) DESC NULLS LAST, o.id DESC`;
```

**Note:** The offers.js query uses subqueries for rating (not a JOIN), so the boost can be added inline. No GROUP BY change needed for the rating subquery.

---

## 9. Mobile: Businesses Listing (businesses.js ~86-127)

**File:** `appredueri_backend/src/routes/businesses.js`

### 9a. Add JOINs

After the existing subquery JOINs (around line ~123), add:

```sql
LEFT JOIN business_subscriptions bsub
  ON bsub.business_id = b.id AND bsub.status IN ('active', 'trial')
LEFT JOIN subscription_plans splan
  ON splan.id = bsub.plan_id
```

### 9b. Modify ORDER BY (line ~125)

Current: `ORDER BY c.name, cat.name, b.name`

The current sort is purely alphabetical. Add a priority tier before it:

```sql
ORDER BY
  CASE WHEN splan.slug = 'premium' THEN 0 WHEN splan.slug = 'standard' THEN 1 ELSE 2 END,
  COALESCE(o.active_offers_count, 0) DESC,
  COALESCE(r.rating_avg, 0) DESC,
  b.name
```

This changes the default sort from alphabetical to relevance-based with tier priority. Premium businesses appear first, then Standard, then Free, each sub-sorted by active offers and rating.

**Alternative (gentler):** If we want to keep alphabetical as primary sort:
```sql
ORDER BY
  CASE WHEN splan.has_search_priority = TRUE THEN 0 ELSE 1 END,
  c.name, cat.name, b.name
```

This puts Premium businesses first within each city/category group but preserves alphabetical ordering within tiers. Use this if the product decision is to keep the existing sort feel.

---

## 10. Queries That Should NOT Be Boosted

For completeness, these queries MUST NOT receive a tier boost:

| Query | Location | Reason |
|-------|----------|--------|
| Deal of the Day | web.js ~106-136, offers.js ~315-355 | Selected by cron/admin, not ranking |
| Similar offers | web.js ~780-795 | Relevance-based, not a listing |
| Followed businesses offers | web.js ~227-238 | Personal feed, not a ranking |
| Business portal listings | business-portal.js | Business owner's own data |
| Admin listings | admin.js | Admin always sees everything unranked |
| Count queries | all files | Pagination counts, no ORDER BY |
| User favorites/collection | web.js ~1620+ | Personal data, not rankings |

---

## 11. Implementation Order

If implementing this plan standalone (without Plan 09):

1. Add bsub + splan JOINs to all 6 affected queries
2. Update GROUP BY clauses to include `splan.slug`
3. Modify ORDER BY in `popular` sorts only
4. Test each endpoint individually
5. Verify free-tier businesses still appear

If implementing alongside Plan 09:

1. Apply ALL changes from both plans to each query in a single pass
2. The JOINs are identical — add once
3. Plan 09 adds SELECT fields (`is_promoted`) + homepage section
4. Plan 11 modifies ORDER BY
5. Both plans modify the same GROUP BY (add `splan.slug, splan.has_promoted_placement`)

---

## 12. Performance Analysis

### 12a. JOIN cost

`business_subscriptions` has at most 1 active row per business (enforced by unique partial index `idx_business_subscriptions_active`). `subscription_plans` has exactly 3 rows. The LEFT JOIN is essentially a lookup, not a scan.

**Estimated overhead:** <1ms per query, well within acceptable limits.

### 12b. EXPLAIN ANALYZE baseline

Before deploying, run EXPLAIN ANALYZE on the modified queries against production data to confirm no plan regressions. Pay attention to:
- Is the planner still using indexes on `offers.is_active`, `offers.end_date`?
- Is the `business_subscriptions` join using `idx_business_subscriptions_active`?

### 12c. COUNT queries

Do NOT add the bsub/splan JOINs to COUNT queries used for pagination. They add cost without benefit since COUNT doesn't use ORDER BY.

### 12d. When to consider caching

If the offers listing endpoint latency exceeds 200ms p95 after these changes, consider:
1. Materializing `tier_boost` as a column on `business_subscriptions` (updated by trigger/cron)
2. Creating a materialized view for common listing queries
3. Adding a Redis cache for the subscription plans lookup

These are future optimizations -- the initial JOIN-based approach is sufficient for the current data scale.

---

## 13. Gotchas

### 13a. `splan.slug` can be NULL
If a business has no active subscription (shouldn't happen after migration 033 but possible with data corruption), `splan.slug` is NULL. The CASE expression handles this with the `ELSE 0` clause. Always use `CASE WHEN splan.slug = 'premium' ...` not `CASE WHEN splan.has_search_priority = TRUE ...` for the boost, because `has_search_priority` being NULL would also be handled differently.

**Actually**, both approaches work because `CASE WHEN NULL = TRUE` evaluates to FALSE in PostgreSQL, landing on ELSE 0. But using `splan.slug` is more explicit and readable.

### 13b. Businesses with `billing_cycle = 'none'` (free tier)
Free-tier subscriptions have `status = 'active'` and `plan_id` pointing to the free plan (slug = 'free'). The CASE expression gives them `ELSE 0`. This is correct.

### 13c. Multiple subscriptions per business
The unique partial index `idx_business_subscriptions_active` ensures at most ONE active/trial subscription per business. The LEFT JOIN will return at most one row per business. No duplication risk.

### 13d. Expired subscriptions
The JOIN condition `bsub.status IN ('active', 'trial')` filters out expired/cancelled subscriptions. A business whose Premium expired will automatically have no boost.

### 13e. Breaking existing sort behavior
The user-facing sort options (`newest`, `discount`, `ending_soon`) are NEVER modified. Only the `popular` (default) sort gets a tier boost. This ensures users who explicitly choose a sort criterion always get exactly what they expect.

### 13f. Aggregate function in ORDER BY
The ORDER BY expressions use aggregate functions like `COUNT(DISTINCT o.id)` and `AVG(r.rating)`. PostgreSQL allows this in GROUP BY queries. The CASE expression referencing `splan.slug` works because `splan.slug` is in the GROUP BY.

### 13g. Interleaving (web.js offers page)
The interleaving algorithm (web.js ~418-432) runs AFTER the ORDER BY query. Boosted offers appear earlier in the raw result set and get distributed by the interleaving logic. The net effect is that promoted offers tend to appear earlier on the page but are still interleaved with non-promoted offers from different businesses.

---

## 14. Verification Checklist

- [ ] Web: Homepage featured offers — Premium offers rank higher on average
- [ ] Web: Homepage top businesses — Premium businesses rank higher
- [ ] Web: Offers page `popular` sort — Premium offers boosted
- [ ] Web: Offers page `newest` sort — NO boost (verify unchanged behavior)
- [ ] Web: Offers page `discount` sort — NO boost
- [ ] Web: Offers page `ending_soon` sort — NO boost
- [ ] Web: Businesses page `popular` sort — Premium businesses boosted
- [ ] Web: Businesses page `rating` sort — NO boost
- [ ] Web: Businesses page `newest` sort — NO boost
- [ ] Mobile: Offers `popular` sort — Premium offers boosted
- [ ] Mobile: Offers default sort (newest) — NO boost
- [ ] Mobile: Businesses listing — Premium businesses prioritized
- [ ] Free-tier businesses still appear in all listings
- [ ] Free business with 5.0 rating outranks Premium business with 3.0 rating on `popular` sort
- [ ] All GROUP BY clauses include `splan.slug`
- [ ] No duplicate rows in results (verify with businesses having exactly 1 subscription)
- [ ] COUNT queries (pagination totals) are NOT affected
- [ ] EXPLAIN ANALYZE shows acceptable query plans
- [ ] Expired/cancelled subscriptions do not provide boost
