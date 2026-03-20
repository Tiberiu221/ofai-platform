// Tier slug constants
const TIERS = {
  FREE: 'free',
  STANDARD: 'standard',
  PREMIUM: 'premium',
};

// Cache plans in memory (refresh on server start + every 1h)
let plansCache = null;
let cacheTimestamp = 0;
let cachePromise = null;
const CACHE_TTL = 60 * 60 * 1000; // 1 hour

async function getPlans(pool) {
  if (plansCache && Date.now() - cacheTimestamp < CACHE_TTL) {
    return plansCache;
  }
  // Dedup: concurrent requests share the same in-flight DB query
  if (cachePromise) return cachePromise;
  cachePromise = (async () => {
    const { rows } = await pool.query(
      'SELECT * FROM subscription_plans ORDER BY sort_order'
    );
    plansCache = {};
    for (const row of rows) {
      plansCache[row.slug] = row;
    }
    cacheTimestamp = Date.now();
    return plansCache;
  })().finally(() => { cachePromise = null; });
  return cachePromise;
}

function invalidateCache() {
  plansCache = null;
  cacheTimestamp = 0;
  cachePromise = null;
}

/**
 * C2: Normalise a plan row into a consistent shape.
 * Works with both raw DB rows (from cache) and aliased JOIN rows (from getBusinessTier query).
 * @param {Object} row - plan row (raw or aliased)
 * @returns {Object} normalised plan object
 */
function normalisePlan(row) {
  return {
    id: row.plan_id ?? row.id,
    slug: row.slug,
    name: row.plan_name ?? row.name,
    price_monthly: row.price_monthly,
    price_yearly: row.price_yearly,
    max_active_offers: row.max_active_offers,
    max_gallery_images: row.max_gallery_images,
    max_locations: row.max_locations,
    max_promo_codes_per_offer: row.max_promo_codes_per_offer,
    analytics_days: row.analytics_days,
    can_respond_reviews: row.can_respond_reviews,
    can_upload_logo: row.can_upload_logo,
    can_upload_cover: row.can_upload_cover,
    has_verified_badge: row.has_verified_badge,
    has_ai_summary: row.has_ai_summary,
    has_ai_suggested_responses: row.has_ai_suggested_responses,
    has_push_on_offer: row.has_push_on_offer,
    has_custom_push: row.has_custom_push,
    has_analytics_charts: row.has_analytics_charts,
    has_analytics_export: row.has_analytics_export,
    has_competitive_insights: row.has_competitive_insights,
    has_promoted_placement: row.has_promoted_placement,
    has_search_priority: row.has_search_priority,
    has_competitor_blocking: row.has_competitor_blocking,
    has_deal_nomination: row.has_deal_nomination,
    has_booking: row.has_booking,
    has_priority_support: row.has_priority_support,
    has_concierge: row.has_concierge,
    badge_type: row.badge_type,
    sort_order: row.sort_order,
  };
}

/**
 * Get active subscription + plan for a business
 * Returns { subscription, plan, tier, isTrial }
 */
async function getBusinessTier(pool, businessId) {
  const { rows } = await pool.query(`
    SELECT
      bs.id              AS sub_id,
      bs.business_id,
      bs.plan_id         AS sub_plan_id,
      bs.status          AS sub_status,
      bs.billing_cycle,
      bs.current_period_start,
      bs.current_period_end,
      bs.trial_start,
      bs.trial_end,
      bs.cancel_at_period_end,
      bs.stripe_subscription_id,
      bs.stripe_customer_id,
      bs.created_at      AS sub_created_at,
      bs.updated_at      AS sub_updated_at,
      sp.id              AS plan_id,
      sp.slug,
      sp.name            AS plan_name,
      sp.price_monthly,
      sp.price_yearly,
      sp.max_active_offers,
      sp.max_gallery_images,
      sp.max_locations,
      sp.max_promo_codes_per_offer,
      sp.analytics_days,
      sp.can_respond_reviews,
      sp.can_upload_logo,
      sp.can_upload_cover,
      sp.has_verified_badge,
      sp.has_ai_summary,
      sp.has_ai_suggested_responses,
      sp.has_push_on_offer,
      sp.has_custom_push,
      sp.has_analytics_charts,
      sp.has_analytics_export,
      sp.has_competitive_insights,
      sp.has_promoted_placement,
      sp.has_search_priority,
      sp.has_competitor_blocking,
      sp.has_deal_nomination,
      sp.has_booking,
      sp.has_priority_support,
      sp.has_concierge,
      sp.badge_type,
      sp.sort_order
    FROM business_subscriptions bs
    JOIN subscription_plans sp ON sp.id = bs.plan_id
    WHERE bs.business_id = $1
      AND bs.status IN ('active', 'trial', 'past_due')
    ORDER BY CASE bs.status WHEN 'active' THEN 0 WHEN 'trial' THEN 1 END,
             sp.sort_order DESC
    LIMIT 1
  `, [businessId]);

  if (rows.length > 0) {
    const row = rows[0];
    return {
      subscription: {
        id: row.sub_id,
        business_id: row.business_id,
        plan_id: row.sub_plan_id,
        status: row.sub_status,
        billing_cycle: row.billing_cycle,
        current_period_start: row.current_period_start,
        current_period_end: row.current_period_end,
        trial_start: row.trial_start,
        trial_end: row.trial_end,
        cancel_at_period_end: row.cancel_at_period_end,
        stripe_subscription_id: row.stripe_subscription_id,
        stripe_customer_id: row.stripe_customer_id,
        created_at: row.sub_created_at,
        updated_at: row.sub_updated_at,
      },
      plan: normalisePlan(row),
      tier: row.slug,
      isTrial: row.sub_status === 'trial',
    };
  }

  // Fallback: free tier
  const plans = await getPlans(pool);
  if (!plans.free) {
    console.error('[Tiers] CRITICAL: free plan not found in subscription_plans');
    throw new Error('Free plan missing from subscription_plans');
  }
  return {
    subscription: null,
    plan: normalisePlan(plans.free),
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

/**
 * Count active offers for a business (used by requireLimit middleware)
 */
async function countActiveOffers(pool, businessId) {
  const { rows } = await pool.query(
    'SELECT COUNT(*)::int AS cnt FROM offers WHERE business_id = $1 AND is_active = true',
    [businessId]
  );
  return rows[0].cnt;
}

/**
 * Count promo codes for a specific offer (used in offerService promo code limit check)
 */
async function countPromoCodesForOffer(pool, offerId) {
  const { rows } = await pool.query(
    'SELECT COUNT(*)::int AS cnt FROM promo_codes WHERE offer_id = $1',
    [offerId]
  );
  return rows[0].cnt;
}

/**
 * Count gallery images for a business (used by requireLimit middleware)
 */
async function countGalleryImages(pool, businessId) {
  const { rows } = await pool.query(
    'SELECT COUNT(*)::int AS cnt FROM business_images WHERE business_id = $1',
    [businessId]
  );
  return rows[0].cnt;
}

/**
 * Count locations for a business (used by requireLimit middleware)
 */
async function countLocations(pool, businessId) {
  const { rows } = await pool.query(
    'SELECT COUNT(*)::int AS cnt FROM business_locations WHERE business_id = $1',
    [businessId]
  );
  return rows[0].cnt;
}

/**
 * Sync the cached badge_type column on the businesses table.
 * Call this EVERY time a subscription changes (upgrade, downgrade, create, expire).
 * MUST be called in the SAME transaction as the subscription change.
 *
 * @param {PoolClient|Pool} db - database client (use same transaction client if in a tx)
 * @param {number} businessId
 * @param {string|null} badgeType - from subscription_plans.badge_type: null, 'verified', 'premium'
 */
const VALID_BADGE_TYPES = [null, 'verified', 'premium'];

async function syncBadgeType(db, businessId, badgeType) {
  if (!VALID_BADGE_TYPES.includes(badgeType)) {
    throw new Error(`[Tiers] Invalid badge type "${badgeType}" — expected one of: ${VALID_BADGE_TYPES.join(', ')}`);
  }
  const result = await db.query(
    'UPDATE businesses SET subscription_badge_type = $1 WHERE id = $2',
    [badgeType, businessId]
  );
  if (result.rowCount === 0) {
    console.warn(`[Tiers] Badge sync: no business found with id ${businessId} (may have been deleted)`);
  } else {
    console.log(`[Tiers] Badge synced for business ${businessId}: ${badgeType || 'none'}`);
  }
}

module.exports = {
  TIERS,
  getPlans,
  getBusinessTier,
  hasFeature,
  checkLimit,
  invalidateCache,
  countActiveOffers,
  countGalleryImages,
  countPromoCodesForOffer,
  countLocations,
  syncBadgeType,
};
