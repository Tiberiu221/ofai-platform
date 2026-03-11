# 06 --- Competitive Insights

> **Scop:** Show Premium businesses how they compare to similar businesses in their city and category (aggregated, anonymized).
> **Dependinte:** `00-subscription-foundation.md` (tier tables, `attachTier`, `requireFeature`)
> **Fisiere afectate:**
> - `src/routes/web.js` (new endpoint)
> - `src/views/public/portal/manage.ejs` (new "Competitive Insights" section in Statistici tab)
> - `src/middleware/tierAuth.js` (used, not modified)
> - No new migration (uses only existing tables)

---

## 1. What "Competitive Insights" Means

Show the business owner how they compare to the **average** of all businesses in the **same city AND same category**. Never reveal individual competitor data -- only aggregates.

### Metrics Compared

| Metric | Your Value | Avg Value | Source Tables |
|---|---|---|---|
| Vizualizari (30 zile) | COUNT from `business_views` | AVG of peers | `business_views` |
| Abonati | COUNT from `followed_businesses` | AVG of peers | `followed_businesses` |
| Oferte active | COUNT from `offers` | AVG of peers | `offers` |
| Rating mediu | AVG from `reviews` | AVG of peers | `reviews` |
| Nr. recenzii | COUNT from `reviews` | AVG of peers | `reviews` |

Each metric shows: your value, category average, and a percentage above/below average.

---

## 2. New Endpoint: `GET /api/web/portal/:businessId/analytics/competitive`

### Location

Add in `src/routes/web.js`, after the analytics export endpoint (plan 05).

### Middleware Chain

```js
router.get(
  "/api/web/portal/:businessId/analytics/competitive",
  requireBusinessOwner,
  attachTier(pool),
  requireFeature('has_competitive_insights'),
  async (req, res) => { ... }
);
```

### Full Endpoint Code

```js
// Competitive Insights (Premium only)
router.get("/api/web/portal/:businessId/analytics/competitive",
  requireBusinessOwner, attachTier(pool), requireFeature('has_competitive_insights'),
  async (req, res) => {
  try {
    const { businessId } = req.params;

    // 1. Get this business's city_id and category_id
    const bizRes = await pool.query(
      'SELECT city_id, category_id FROM businesses WHERE id = $1',
      [businessId]
    );
    if (bizRes.rows.length === 0) {
      return res.status(404).json({ message: 'Business negasit' });
    }
    const { city_id, category_id } = bizRes.rows[0];

    if (!city_id || !category_id) {
      return res.json({
        available: false,
        reason: 'Business-ul nu are oras sau categorie setata.',
      });
    }

    // 2. Count peers in same city+category (excluding self)
    const peersCountRes = await pool.query(
      `SELECT COUNT(*) as cnt FROM businesses
       WHERE city_id = $1 AND category_id = $2 AND id != $3`,
      [city_id, category_id, businessId]
    );
    const peersCount = parseInt(peersCountRes.rows[0].cnt) || 0;

    if (peersCount < 3) {
      return res.json({
        available: false,
        reason: 'Insuficiente date. Trebuie cel putin 3 business-uri similare in orasul tau pentru comparatie.',
        peersCount,
      });
    }

    // 3. Get YOUR metrics
    const [myViewsRes, mySubsRes, myOffersRes, myReviewsRes] = await Promise.all([
      pool.query(
        `SELECT COUNT(*) as cnt FROM business_views
         WHERE business_id = $1 AND viewed_at >= NOW() - INTERVAL '30 days'`,
        [businessId]
      ),
      pool.query(
        'SELECT COUNT(*) as cnt FROM followed_businesses WHERE business_id = $1',
        [businessId]
      ),
      pool.query(
        `SELECT COUNT(*) as cnt FROM offers
         WHERE business_id = $1 AND is_active = true AND end_date >= CURRENT_DATE`,
        [businessId]
      ),
      pool.query(
        `SELECT COUNT(*) as review_count, COALESCE(AVG(rating), 0) as avg_rating
         FROM reviews WHERE business_id = $1`,
        [businessId]
      ),
    ]);

    const myMetrics = {
      views30d: parseInt(myViewsRes.rows[0].cnt) || 0,
      subscribers: parseInt(mySubsRes.rows[0].cnt) || 0,
      activeOffers: parseInt(myOffersRes.rows[0].cnt) || 0,
      avgRating: parseFloat(parseFloat(myReviewsRes.rows[0].avg_rating).toFixed(1)) || 0,
      reviewCount: parseInt(myReviewsRes.rows[0].review_count) || 0,
    };

    // 4. Get PEER AVERAGES (same city + category, excluding self)
    //    Single query with subqueries for efficiency
    const peerRes = await pool.query(`
      SELECT
        -- Avg views last 30 days
        (SELECT COALESCE(AVG(v_cnt), 0) FROM (
          SELECT COUNT(*) as v_cnt
          FROM businesses b2
          LEFT JOIN business_views bv ON bv.business_id = b2.id
            AND bv.viewed_at >= NOW() - INTERVAL '30 days'
          WHERE b2.city_id = $1 AND b2.category_id = $2 AND b2.id != $3
          GROUP BY b2.id
        ) sub_views) as avg_views_30d,

        -- Avg subscribers
        (SELECT COALESCE(AVG(s_cnt), 0) FROM (
          SELECT COUNT(*) as s_cnt
          FROM businesses b2
          LEFT JOIN followed_businesses fb ON fb.business_id = b2.id
          WHERE b2.city_id = $1 AND b2.category_id = $2 AND b2.id != $3
          GROUP BY b2.id
        ) sub_subs) as avg_subscribers,

        -- Avg active offers
        (SELECT COALESCE(AVG(o_cnt), 0) FROM (
          SELECT COUNT(*) as o_cnt
          FROM businesses b2
          LEFT JOIN offers o ON o.business_id = b2.id AND o.is_active = true AND o.end_date >= CURRENT_DATE
          WHERE b2.city_id = $1 AND b2.category_id = $2 AND b2.id != $3
          GROUP BY b2.id
        ) sub_offers) as avg_active_offers,

        -- Avg rating (only businesses with at least 1 review)
        (SELECT COALESCE(AVG(b_avg), 0) FROM (
          SELECT AVG(r.rating) as b_avg
          FROM businesses b2
          JOIN reviews r ON r.business_id = b2.id
          WHERE b2.city_id = $1 AND b2.category_id = $2 AND b2.id != $3
          GROUP BY b2.id
          HAVING COUNT(r.id) >= 1
        ) sub_rating) as avg_rating,

        -- Avg review count
        (SELECT COALESCE(AVG(r_cnt), 0) FROM (
          SELECT COUNT(*) as r_cnt
          FROM businesses b2
          LEFT JOIN reviews r ON r.business_id = b2.id
          WHERE b2.city_id = $1 AND b2.category_id = $2 AND b2.id != $3
          GROUP BY b2.id
        ) sub_review_count) as avg_review_count
    `, [city_id, category_id, businessId]);

    const peer = peerRes.rows[0];
    const peerAvg = {
      views30d: parseFloat(parseFloat(peer.avg_views_30d).toFixed(1)),
      subscribers: parseFloat(parseFloat(peer.avg_subscribers).toFixed(1)),
      activeOffers: parseFloat(parseFloat(peer.avg_active_offers).toFixed(1)),
      avgRating: parseFloat(parseFloat(peer.avg_rating).toFixed(1)),
      reviewCount: parseFloat(parseFloat(peer.avg_review_count).toFixed(1)),
    };

    // 5. Calculate percentage differences
    function pctDiff(mine, avg) {
      if (avg === 0) return mine > 0 ? 100 : 0;
      return Math.round(((mine - avg) / avg) * 100);
    }

    const insights = [
      {
        metric: 'Vizualizari (30 zile)',
        yours: myMetrics.views30d,
        categoryAvg: peerAvg.views30d,
        diff: pctDiff(myMetrics.views30d, peerAvg.views30d),
      },
      {
        metric: 'Abonati',
        yours: myMetrics.subscribers,
        categoryAvg: peerAvg.subscribers,
        diff: pctDiff(myMetrics.subscribers, peerAvg.subscribers),
      },
      {
        metric: 'Oferte active',
        yours: myMetrics.activeOffers,
        categoryAvg: peerAvg.activeOffers,
        diff: pctDiff(myMetrics.activeOffers, peerAvg.activeOffers),
      },
      {
        metric: 'Rating',
        yours: myMetrics.avgRating,
        categoryAvg: peerAvg.avgRating,
        diff: pctDiff(myMetrics.avgRating, peerAvg.avgRating),
      },
      {
        metric: 'Recenzii',
        yours: myMetrics.reviewCount,
        categoryAvg: peerAvg.reviewCount,
        diff: pctDiff(myMetrics.reviewCount, peerAvg.reviewCount),
      },
    ];

    res.json({
      available: true,
      peersCount,
      insights,
    });

  } catch (err) {
    console.error('[Web API] Competitive insights error:', err);
    res.status(500).json({ message: 'Eroare la analiza competitiva' });
  }
});
```

---

## 3. Caching Strategy

The peer aggregation query is expensive (joins across multiple tables). Implement a simple in-memory cache:

### Option A: Simple per-business cache (recommended)

Add at the top of web.js (or in a separate helper):

```js
// Competitive insights cache (24h TTL)
const competitiveCache = new Map();
const COMPETITIVE_CACHE_TTL = 24 * 60 * 60 * 1000; // 24 hours
```

Then wrap the main query section in the endpoint:

```js
// Check cache
const cacheKey = `comp_${businessId}`;
const cached = competitiveCache.get(cacheKey);
if (cached && Date.now() - cached.timestamp < COMPETITIVE_CACHE_TTL) {
  return res.json(cached.data);
}

// ... run queries ...

// Store in cache
const responseData = { available: true, peersCount, insights };
competitiveCache.set(cacheKey, { data: responseData, timestamp: Date.now() });

res.json(responseData);
```

Add cache cleanup in the cron jobs file (`src/services/cronJobs.js`):

```js
// Every 6 hours — clean competitive insights cache
cron.schedule('0 */6 * * *', () => {
  const now = Date.now();
  for (const [key, val] of competitiveCache.entries()) {
    if (now - val.timestamp > COMPETITIVE_CACHE_TTL) {
      competitiveCache.delete(key);
    }
  }
});
```

**Note:** Since `competitiveCache` is defined in `web.js` and cron jobs are in `cronJobs.js`, either:
- (a) Export the cache and import it in cronJobs, or
- (b) Skip the cron cleanup and let the TTL check inside the endpoint handle staleness (simpler, slight memory cost for entries that are never re-fetched -- negligible for the expected business count).

**Recommended: option (b)** -- skip cron cleanup. The Map will grow to at most N entries where N = number of Premium businesses. With ~10-50 Premium businesses expected initially, this is trivially small.

---

## 4. UI Changes in `manage.ejs`

### 4.1 New section in Statistici tab

Insert a new `glass-card` section between the Stats Cards grid (ends at line ~1045) and the Rating Distribution card (starts at line ~1047). This section loads competitive insights via fetch when the user clicks the Statistici tab.

Add this HTML block:

```html
<!-- Competitive Insights (Premium only) -->
<% if (tier && tier.plan && tier.plan.has_competitive_insights) { %>
  <div class="glass-card" id="competitive-insights-card" style="margin-top: 16px;">
    <h3 class="section-title">Analiza Competitiva</h3>
    <p style="color: var(--text-secondary); font-size: 13px; margin-bottom: 16px;">
      Cum te compari cu business-urile similare din aceeasi categorie si oras.
    </p>
    <div id="competitive-content">
      <div style="text-align: center; padding: 24px; color: var(--text-tertiary);">
        Se incarca...
      </div>
    </div>
  </div>
<% } %>
```

### 4.2 CSS for competitive insights bars

Add to the `<style>` block in manage.ejs:

```css
.comp-row {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px 0;
  border-bottom: 1px solid rgba(255,255,255,0.05);
}
.comp-row:last-child { border-bottom: none; }
.comp-metric {
  width: 140px;
  flex-shrink: 0;
  font-size: 13px;
  color: var(--text-secondary);
}
.comp-bars {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.comp-bar-wrap {
  display: flex;
  align-items: center;
  gap: 8px;
}
.comp-bar-label {
  width: 60px;
  flex-shrink: 0;
  font-size: 11px;
  color: var(--text-tertiary);
  text-align: right;
}
.comp-bar-track {
  flex: 1;
  height: 8px;
  background: rgba(255,255,255,0.06);
  border-radius: 4px;
  overflow: hidden;
}
.comp-bar-fill {
  height: 100%;
  border-radius: 4px;
  transition: width 0.5s ease;
}
.comp-bar-fill.yours { background: #fb923c; }
.comp-bar-fill.avg { background: #3b82f6; }
.comp-bar-value {
  width: 48px;
  flex-shrink: 0;
  font-size: 12px;
  font-weight: 500;
  color: var(--text-primary);
}
.comp-diff {
  width: 70px;
  flex-shrink: 0;
  text-align: right;
  font-size: 12px;
  font-weight: 600;
}
.comp-diff.positive { color: #22c55e; }
.comp-diff.negative { color: #ef4444; }
.comp-diff.neutral { color: var(--text-tertiary); }
.comp-legend {
  display: flex;
  gap: 16px;
  margin-bottom: 12px;
  font-size: 12px;
  color: var(--text-secondary);
}
.comp-legend-dot {
  display: inline-block;
  width: 10px;
  height: 10px;
  border-radius: 50%;
  margin-right: 4px;
}
.comp-no-data {
  text-align: center;
  padding: 32px 16px;
  color: var(--text-tertiary);
  font-size: 14px;
}
```

### 4.3 JavaScript to load competitive insights

Add this inside the existing IIFE `(function() { ... })()` in the `<script>` block:

```js
/* -- Competitive Insights -- */
var competitiveLoaded = false;

function loadCompetitiveInsights() {
  if (competitiveLoaded) return;
  competitiveLoaded = true;

  var container = document.getElementById('competitive-content');
  if (!container) return;

  apiFetch('/api/web/portal/' + businessId + '/analytics/competitive')
    .then(function(res) { return res.json(); })
    .then(function(data) {
      if (!data.available) {
        container.innerHTML = '<div class="comp-no-data">' +
          '<svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" style="margin-bottom: 8px; opacity: 0.4;">' +
          '<circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>' +
          '<div>' + (data.reason || 'Date insuficiente') + '</div>' +
          '</div>';
        return;
      }

      var html = '<div class="comp-legend">' +
        '<span><span class="comp-legend-dot" style="background:#fb923c;"></span>Tu</span>' +
        '<span><span class="comp-legend-dot" style="background:#3b82f6;"></span>Media categoriei (' + data.peersCount + ' business-uri)</span>' +
        '</div>';

      // Find max value across all metrics for bar scaling
      var globalMax = 0;
      data.insights.forEach(function(ins) {
        var m = Math.max(ins.yours, ins.categoryAvg);
        if (m > globalMax) globalMax = m;
      });

      data.insights.forEach(function(ins) {
        // Per-metric max for proportional bars
        var rowMax = Math.max(ins.yours, ins.categoryAvg, 1);
        var yoursPct = (ins.yours / rowMax) * 100;
        var avgPct = (ins.categoryAvg / rowMax) * 100;

        var diffClass = ins.diff > 0 ? 'positive' : (ins.diff < 0 ? 'negative' : 'neutral');
        var diffText = ins.diff > 0 ? '+' + ins.diff + '%' : (ins.diff < 0 ? ins.diff + '%' : '0%');

        html += '<div class="comp-row">' +
          '<div class="comp-metric">' + ins.metric + '</div>' +
          '<div class="comp-bars">' +
            '<div class="comp-bar-wrap">' +
              '<div class="comp-bar-label">Tu</div>' +
              '<div class="comp-bar-track"><div class="comp-bar-fill yours" style="width:' + yoursPct + '%"></div></div>' +
              '<div class="comp-bar-value">' + ins.yours + '</div>' +
            '</div>' +
            '<div class="comp-bar-wrap">' +
              '<div class="comp-bar-label">Media</div>' +
              '<div class="comp-bar-track"><div class="comp-bar-fill avg" style="width:' + avgPct + '%"></div></div>' +
              '<div class="comp-bar-value">' + ins.categoryAvg + '</div>' +
            '</div>' +
          '</div>' +
          '<div class="comp-diff ' + diffClass + '">' + diffText + '</div>' +
        '</div>';
      });

      container.innerHTML = html;
    })
    .catch(function(err) {
      console.error('[Competitive] Error:', err);
      container.innerHTML = '<div class="comp-no-data">Eroare la incarcarea datelor.</div>';
    });
}
```

### 4.4 Trigger load when Statistici tab opens

Find the existing `switchTab` function in the script block. It currently handles tab switching. Add a call to load competitive insights when the statistici tab is activated:

```js
// Inside the switchTab function, after the tab panel activation logic:
if (tabName === 'statistici' && typeof loadCompetitiveInsights === 'function') {
  loadCompetitiveInsights();
}
```

The existing `switchTab` function is defined around line 1389. Find the section where `tab-panel` elements get the `active` class toggled, and add the check there.

---

## 5. Privacy Considerations

- **NEVER** show individual business data. All peer queries use aggregate functions (`AVG`, `COUNT`) grouped across all peers.
- The `peersCount` field tells the user how many businesses they are compared against, but no names or IDs are exposed.
- **Minimum peer threshold:** 3 businesses. If fewer than 3 peers exist in the same city+category, return `{ available: false }` to prevent statistical de-anonymization.
- The `avg_rating` peer metric only includes businesses with at least 1 review (`HAVING COUNT(r.id) >= 1`) to avoid skewing from unreviewed businesses.

---

## 6. SQL Query Performance Notes

The peer aggregation query runs 5 subqueries in a single `SELECT`. Each subquery:
1. Finds all businesses with matching `city_id` AND `category_id` (excluding self)
2. LEFT JOINs to the relevant analytics table
3. Groups by `b2.id` to get per-business counts
4. Takes the `AVG` across all businesses

### Index coverage

These existing indexes cover the queries:
- `businesses(city_id)` -- may not exist; check and add if needed
- `businesses(category_id)` -- may not exist; check and add if needed
- `idx_business_views_bid_date` on `business_views(business_id, viewed_at)` -- exists (migration 028)
- `followed_businesses(business_id)` -- may need index
- `offers(business_id)` -- may need index
- `reviews(business_id)` -- may need index

### Recommended indexes (add if not present)

```sql
-- Check if these exist first; create only if missing
CREATE INDEX IF NOT EXISTS idx_businesses_city_cat ON businesses(city_id, category_id);
CREATE INDEX IF NOT EXISTS idx_followed_businesses_bid ON followed_businesses(business_id);
CREATE INDEX IF NOT EXISTS idx_offers_business_active ON offers(business_id, is_active, end_date);
CREATE INDEX IF NOT EXISTS idx_reviews_business_id ON reviews(business_id);
```

You can add these in a new migration `034_competitive_indexes.sql` or as part of the plan 06 implementation. These are safe (`IF NOT EXISTS`) and non-destructive.

With the 24-hour cache, even without perfect indexes, the query runs at most once per day per Premium business. At current data volumes (hundreds of businesses, not millions), the query should complete in under 100ms.

---

## 7. Gotchas

1. **Small cities (<3 competitors):** Return `{ available: false, reason: '...' }`. The UI must handle this gracefully and show a clear message. Do NOT show misleading empty bars.

2. **Missing city_id or category_id on the business:** Some businesses may not have these set. Check for nulls before running the peer query.

3. **LEFT JOIN vs JOIN for peer metrics:** Use LEFT JOIN for views, subscribers, offers, review counts (so businesses with 0 in a metric still count toward the average). Use JOIN only for avg_rating (to exclude unreviewed businesses from the rating average).

4. **Cache invalidation:** The 24-hour cache means insights may be slightly stale. This is acceptable since competitive data changes slowly. If a business upgrades to Premium and wants to see insights immediately, the cache will miss (new entry) and fetch fresh data.

5. **Division by zero:** The `pctDiff` function handles `avg === 0` by returning 100% if yours > 0, or 0% if both are 0. Test edge cases where all peers have 0 views.

6. **Floating point display:** Peer averages are rounded to 1 decimal (`toFixed(1)`). This is important for metrics like avg_rating (4.3 vs 4.28571...) and subscriber counts (12.5 average makes sense).

7. **`attachTier(pool)` import:** Plan 05 already imports `attachTier` and `requireFeature` at the top of web.js. If implementing plan 06 before plan 05, add the import yourself:
   ```js
   const { attachTier, requireFeature } = require('../middleware/tierAuth');
   ```

8. **The competitive card loads on-demand:** It fetches data only when the user clicks the Statistici tab (lazy loading). This avoids slowing down the initial page load, which is important because the manage page already makes multiple API calls.

---

## 8. Verification Checklist

After implementation:
- [ ] Endpoint returns `{ available: true, insights: [...] }` for a Premium business with 3+ peers
- [ ] Endpoint returns `{ available: false }` with `<3` peers
- [ ] Endpoint returns `{ available: false }` when business has no city/category
- [ ] Free/Standard tier gets 403 `upgrade_required`
- [ ] All 5 metrics show correct your-value vs peer-average
- [ ] Percentage diff is calculated correctly (positive = above average, negative = below)
- [ ] No individual competitor data is exposed in the response
- [ ] Cache works (second request within 24h returns cached data)
- [ ] UI shows loading state, then renders comparison bars
- [ ] UI handles `available: false` gracefully with clear message
- [ ] Competitive Insights card is hidden for Free/Standard tiers in manage.ejs
