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
 * Returns { subscription, plan, tier, isTrial }
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
async function syncBadgeType(db, businessId, badgeType) {
  await db.query(
    'UPDATE businesses SET subscription_badge_type = $1 WHERE id = $2',
    [badgeType, businessId]
  );
  console.log(`[Tiers] Badge synced for business ${businessId}: ${badgeType || 'none'}`);
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
