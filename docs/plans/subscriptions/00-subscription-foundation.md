# 00 — Subscription Foundation

> **Scop:** Schema DB, constante tier-uri, helper functions, middleware skeleton.
> **Dependințe:** Niciuna (primul plan de implementat).
> **Fișiere afectate:** Migration nouă, `src/helpers/tiers.js` (NOU), `src/middleware/tierAuth.js` (NOU), `src/routes/business-portal.js`

---

## 1. Migration: `033_business_subscriptions.sql`

```sql
-- Tier plans (static reference data)
CREATE TABLE IF NOT EXISTS subscription_plans (
  id SERIAL PRIMARY KEY,
  slug VARCHAR(20) UNIQUE NOT NULL,       -- 'free', 'standard', 'premium'
  name VARCHAR(50) NOT NULL,              -- 'Gratuit', 'Standard', 'Premium'
  price_monthly INTEGER NOT NULL,         -- in bani (RON * 100): 0, 4900, 19900
  price_yearly INTEGER NOT NULL,          -- in bani: 0, 49000, 199000
  max_active_offers INTEGER,              -- NULL = unlimited
  max_gallery_images INTEGER,             -- NULL = unlimited
  max_locations INTEGER,                  -- NULL = unlimited
  max_promo_codes_per_offer INTEGER,      -- NULL = unlimited
  analytics_days INTEGER NOT NULL DEFAULT 7,  -- 7, 30, 90
  can_respond_reviews BOOLEAN NOT NULL DEFAULT FALSE,
  can_upload_logo BOOLEAN NOT NULL DEFAULT FALSE,
  can_upload_cover BOOLEAN NOT NULL DEFAULT FALSE,
  has_verified_badge BOOLEAN NOT NULL DEFAULT FALSE,
  has_ai_summary BOOLEAN NOT NULL DEFAULT FALSE,
  has_push_on_offer BOOLEAN NOT NULL DEFAULT FALSE,
  has_custom_push BOOLEAN NOT NULL DEFAULT FALSE,
  has_analytics_charts BOOLEAN NOT NULL DEFAULT FALSE,
  has_analytics_export BOOLEAN NOT NULL DEFAULT FALSE,
  has_competitive_insights BOOLEAN NOT NULL DEFAULT FALSE,
  has_promoted_placement BOOLEAN NOT NULL DEFAULT FALSE,
  has_search_priority BOOLEAN NOT NULL DEFAULT FALSE,
  has_competitor_blocking BOOLEAN NOT NULL DEFAULT FALSE,
  has_deal_nomination BOOLEAN NOT NULL DEFAULT FALSE,
  has_booking BOOLEAN NOT NULL DEFAULT FALSE,
  has_priority_support BOOLEAN NOT NULL DEFAULT FALSE,
  badge_type VARCHAR(20) DEFAULT NULL,    -- NULL, 'verified', 'premium'
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Business subscriptions (one active per business)
CREATE TABLE IF NOT EXISTS business_subscriptions (
  id SERIAL PRIMARY KEY,
  business_id INTEGER NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  plan_id INTEGER NOT NULL REFERENCES subscription_plans(id),
  status VARCHAR(20) NOT NULL DEFAULT 'active',
    -- 'active', 'trial', 'past_due', 'cancelled', 'expired'
  billing_cycle VARCHAR(10) NOT NULL DEFAULT 'monthly',
    -- 'monthly', 'yearly', 'none' (free)
  current_period_start TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  current_period_end TIMESTAMPTZ,          -- NULL for free tier
  trial_start TIMESTAMPTZ,
  trial_end TIMESTAMPTZ,
  cancel_at_period_end BOOLEAN NOT NULL DEFAULT FALSE,
  stripe_subscription_id VARCHAR(255),     -- populated later by Stripe integration
  stripe_customer_id VARCHAR(255),         -- populated later
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Unique: one active subscription per business
CREATE UNIQUE INDEX idx_business_subscriptions_active
  ON business_subscriptions(business_id)
  WHERE status IN ('active', 'trial');

-- Index for expiry checks (cron job)
CREATE INDEX idx_business_subscriptions_expiry
  ON business_subscriptions(current_period_end)
  WHERE status IN ('active', 'trial');

-- Subscription change history (audit trail)
CREATE TABLE IF NOT EXISTS subscription_history (
  id SERIAL PRIMARY KEY,
  business_id INTEGER NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  from_plan_id INTEGER REFERENCES subscription_plans(id),
  to_plan_id INTEGER NOT NULL REFERENCES subscription_plans(id),
  action VARCHAR(20) NOT NULL,
    -- 'created', 'upgraded', 'downgraded', 'cancelled', 'renewed', 'trial_started', 'trial_expired'
  reason TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_subscription_history_business
  ON subscription_history(business_id, created_at DESC);

-- Seed the 3 plans
INSERT INTO subscription_plans
  (slug, name, price_monthly, price_yearly, sort_order,
   max_active_offers, max_gallery_images, max_locations, max_promo_codes_per_offer,
   analytics_days, can_respond_reviews, can_upload_logo, can_upload_cover,
   has_verified_badge, has_ai_summary, has_push_on_offer, has_custom_push,
   has_analytics_charts, has_analytics_export, has_competitive_insights,
   has_promoted_placement, has_search_priority, has_competitor_blocking,
   has_deal_nomination, has_booking, has_priority_support, badge_type)
VALUES
  -- FREE
  ('free', 'Gratuit', 0, 0, 0,
   2, 3, 1, 0,
   7, FALSE, FALSE, FALSE,
   FALSE, FALSE, FALSE, FALSE,
   FALSE, FALSE, FALSE,
   FALSE, FALSE, FALSE,
   FALSE, FALSE, FALSE, NULL),

  -- STANDARD
  ('standard', 'Standard', 4900, 49000, 1,
   10, 8, 3, 3,
   30, TRUE, TRUE, TRUE,
   TRUE, TRUE, TRUE, FALSE,
   TRUE, FALSE, FALSE,
   FALSE, FALSE, FALSE,
   FALSE, TRUE, FALSE, 'verified'),

  -- PREMIUM
  ('premium', 'Premium', 19900, 199000, 2,
   NULL, NULL, NULL, NULL,
   90, TRUE, TRUE, TRUE,
   TRUE, TRUE, TRUE, TRUE,
   TRUE, TRUE, TRUE,
   TRUE, TRUE, TRUE,
   TRUE, TRUE, TRUE, 'premium');

-- Assign all existing businesses to free tier
INSERT INTO business_subscriptions (business_id, plan_id, status, billing_cycle)
SELECT b.id, sp.id, 'active', 'none'
FROM businesses b
CROSS JOIN subscription_plans sp
WHERE sp.slug = 'free'
  AND NOT EXISTS (
    SELECT 1 FROM business_subscriptions bs WHERE bs.business_id = b.id
  );
```

---

## 2. Helper: `src/helpers/tiers.js` (NOU)

```js
// Tier slug constants
const TIERS = {
  FREE: 'free',
  STANDARD: 'standard',
  PREMIUM: 'premium',
};

// Cache plans in memory (refresh on server start + every 1h)
let plansCache = null;
let cacheTimestamp = 0;
const CACHE_TTL = 60 * 60 * 1000; // 1 hour

async function getPlans(pool) {
  if (plansCache && Date.now() - cacheTimestamp < CACHE_TTL) {
    return plansCache;
  }
  const { rows } = await pool.query(
    'SELECT * FROM subscription_plans ORDER BY sort_order'
  );
  plansCache = {};
  for (const row of rows) {
    plansCache[row.slug] = row;
  }
  cacheTimestamp = Date.now();
  return plansCache;
}

function invalidateCache() {
  plansCache = null;
  cacheTimestamp = 0;
}

/**
 * Get active subscription + plan for a business
 * Returns { subscription, plan } or { subscription: null, plan: freePlan }
 */
async function getBusinessTier(pool, businessId) {
  const { rows } = await pool.query(`
    SELECT bs.*, sp.*,
           bs.id AS subscription_id,
           sp.id AS plan_id
    FROM business_subscriptions bs
    JOIN subscription_plans sp ON sp.id = bs.plan_id
    WHERE bs.business_id = $1
      AND bs.status IN ('active', 'trial')
    LIMIT 1
  `, [businessId]);

  if (rows.length > 0) {
    return {
      subscription: rows[0],
      plan: rows[0],
      tier: rows[0].slug,
      isTrial: rows[0].status === 'trial',
    };
  }

  // Fallback: free tier
  const plans = await getPlans(pool);
  return {
    subscription: null,
    plan: plans.free,
    tier: TIERS.FREE,
    isTrial: false,
  };
}

/**
 * Check if a business has a specific feature enabled
 * featureKey = column name from subscription_plans (e.g. 'can_respond_reviews')
 */
async function hasFeature(pool, businessId, featureKey) {
  const { plan } = await getBusinessTier(pool, businessId);
  return !!plan[featureKey];
}

/**
 * Check if a business is within a numeric limit
 * limitKey = 'max_active_offers' | 'max_gallery_images' | etc.
 * currentCount = current number of items
 * Returns { allowed: boolean, limit: number|null, current: number }
 */
async function checkLimit(pool, businessId, limitKey, currentCount) {
  const { plan } = await getBusinessTier(pool, businessId);
  const limit = plan[limitKey];
  if (limit === null) return { allowed: true, limit: null, current: currentCount };
  return { allowed: currentCount < limit, limit, current: currentCount };
}

module.exports = { TIERS, getPlans, getBusinessTier, hasFeature, checkLimit, invalidateCache };
```

---

## 3. Middleware: `src/middleware/tierAuth.js` (NOU)

```js
const { getBusinessTier, hasFeature, checkLimit } = require('../helpers/tiers');

/**
 * Middleware: attach tier info to req
 * Usage: router.use('/:businessId/*', attachTier)
 * Sets req.tier = { subscription, plan, tier, isTrial }
 */
function attachTier(pool) {
  return async (req, res, next) => {
    const businessId = req.params.businessId || req.params.bid;
    if (!businessId) return next();
    try {
      req.tier = await getBusinessTier(pool, parseInt(businessId));
      next();
    } catch (err) {
      console.error('Tier lookup error:', err);
      next(); // fail open — don't block on tier errors
    }
  };
}

/**
 * Middleware factory: require a boolean feature
 * Usage: router.post('/respond', requireFeature('can_respond_reviews'))
 */
function requireFeature(featureKey) {
  return (req, res, next) => {
    if (!req.tier) return res.status(500).json({ error: 'Tier info missing' });
    if (!req.tier.plan[featureKey]) {
      return res.status(403).json({
        error: 'upgrade_required',
        message: `Această funcție necesită un plan superior.`,
        currentTier: req.tier.tier,
        requiredFeature: featureKey,
      });
    }
    next();
  };
}

/**
 * Middleware factory: check a numeric limit
 * countFn = async (pool, businessId) => number
 * Usage: router.post('/offers', requireLimit('max_active_offers', countActiveOffers))
 */
function requireLimit(limitKey, countFn) {
  return async (req, res, next) => {
    if (!req.tier) return res.status(500).json({ error: 'Tier info missing' });
    const businessId = req.params.businessId || req.params.bid;
    try {
      const count = await countFn(req.app.get('pool'), parseInt(businessId));
      const { allowed, limit } = {
        allowed: req.tier.plan[limitKey] === null || count < req.tier.plan[limitKey],
        limit: req.tier.plan[limitKey],
      };
      if (!allowed) {
        return res.status(403).json({
          error: 'limit_reached',
          message: `Ai atins limita de ${limit} pentru planul tău (${req.tier.plan.name}).`,
          currentTier: req.tier.tier,
          limit,
          current: count,
        });
      }
      next();
    } catch (err) {
      console.error('Limit check error:', err);
      next(err);
    }
  };
}

module.exports = { attachTier, requireFeature, requireLimit };
```

---

## 4. Integrare în `business-portal.js`

Adaugă `attachTier` pe toate rutele business portal:

```js
// La începutul fișierului, după imports:
const { attachTier } = require('../middleware/tierAuth');

// După businessAuth middleware, înainte de rute:
router.use('/:businessId', attachTier(pool));

// Acum req.tier este disponibil pe TOATE rutele business portal
```

---

## 5. API: GET `/subscription` pentru business portal

Endpoint nou pentru a citi tier-ul curent (folosit de manage.ejs):

```js
// business-portal.js
router.get('/:businessId/subscription', async (req, res) => {
  // req.tier is already attached by middleware
  const { plan, tier, isTrial, subscription } = req.tier;
  res.json({
    tier,
    plan: {
      slug: plan.slug,
      name: plan.name,
      priceMonthly: plan.price_monthly,
      priceYearly: plan.price_yearly,
      maxActiveOffers: plan.max_active_offers,
      maxGalleryImages: plan.max_gallery_images,
      maxLocations: plan.max_locations,
      maxPromoCodesPerOffer: plan.max_promo_codes_per_offer,
      analyticsDays: plan.analytics_days,
      // ... all boolean features
    },
    isTrial,
    trialEnd: subscription?.trial_end || null,
    periodEnd: subscription?.current_period_end || null,
    cancelAtPeriodEnd: subscription?.cancel_at_period_end || false,
  });
});
```

---

## 6. Cron Job: verificare expirări

Adaugă în `cronJobs.js`:

```js
// Daily at 04:00 — check subscription expirations
cron.schedule('0 4 * * *', async () => {
  try {
    // Expire trials
    const trialResult = await pool.query(`
      UPDATE business_subscriptions
      SET status = 'expired', updated_at = NOW()
      WHERE status = 'trial'
        AND trial_end < NOW()
      RETURNING business_id
    `);

    // Downgrade expired trials to free
    if (trialResult.rows.length > 0) {
      const freePlan = await pool.query(
        "SELECT id FROM subscription_plans WHERE slug = 'free'"
      );
      for (const row of trialResult.rows) {
        await pool.query(`
          INSERT INTO business_subscriptions (business_id, plan_id, status, billing_cycle)
          VALUES ($1, $2, 'active', 'none')
        `, [row.business_id, freePlan.rows[0].id]);
        await pool.query(`
          INSERT INTO subscription_history (business_id, from_plan_id, to_plan_id, action, reason)
          VALUES ($1, NULL, $2, 'trial_expired', 'Trial period ended')
        `, [row.business_id, freePlan.rows[0].id]);
      }
    }

    // Expire paid subscriptions past period_end (if not renewed by Stripe webhook)
    await pool.query(`
      UPDATE business_subscriptions
      SET status = 'expired', updated_at = NOW()
      WHERE status = 'active'
        AND billing_cycle != 'none'
        AND current_period_end < NOW()
        AND stripe_subscription_id IS NULL
    `);

    console.log(`Subscription check: ${trialResult.rows.length} trials expired`);
  } catch (err) {
    console.error('Subscription expiry check error:', err);
  }
});
```

---

## 7. Gotchas

1. **Unique index `idx_business_subscriptions_active`** — previne 2 subscripții active pe același business. La upgrade, vechea trebuie marcată `cancelled` ÎNAINTE de insert-ul noii subscripții (într-un transaction).
2. **`plansCache` invalidation** — dacă admin modifică planurile, apelează `invalidateCache()`. Altfel, cache-ul se refreshează la 1h.
3. **Fail-open pe `attachTier`** — dacă lookup-ul eșuează, middleware-ul nu blochează (continuă fără `req.tier`). `requireFeature` și `requireLimit` vor returna 500 dacă `req.tier` lipsește.
4. **Prețuri în bani (cenți)** — `price_monthly = 4900` = 49.00 RON. Evită floating point.
5. **Migration assignment** — `INSERT INTO business_subscriptions` la final asignează TOATE business-urile existente la free. Idempotent (WHERE NOT EXISTS).
6. **`current_period_end = NULL` pentru free** — free tier nu expiră niciodată.

---

## 8. Verificare

După implementare:
- [ ] Migration rulată pe production
- [ ] Toate business-urile existente au subscripție free
- [ ] `GET /:businessId/subscription` returnează tier corect
- [ ] `req.tier` disponibil pe toate rutele business portal
- [ ] Cron job-ul de expirare funcționează
- [ ] Planurile cache-uite se refreshează
