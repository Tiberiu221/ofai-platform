const { getBusinessTier } = require('../helpers/tiers');
const pool = require('../db');

// Fail-closed: tier gating is ON by default. Only disabled with explicit flag.
if (process.env.TIER_GATING_DISABLED === 'true') {
  console.warn('[TierAuth] WARNING: TIER_GATING_DISABLED is set — all tier limits and feature gates are BYPASSED. Remove this flag in production.');
}

/**
 * Middleware: attach tier info to req
 * Usage: router.use('/:businessId', attachTier())
 * Sets req.tier = { subscription, plan, tier, isTrial }
 */
function attachTier() {
  return async (req, res, next) => {
    const businessId = parseInt(req.params.businessId || req.params.bid);
    if (!businessId || isNaN(businessId)) return next();
    try {
      req.tier = await getBusinessTier(pool, businessId);
      next();
    } catch (err) {
      console.error('Tier lookup error:', err);
      req.tier = null;
      if (process.env.TIER_GATING_DISABLED !== 'true') {
        return res.status(503).json({ error: 'Serviciu temporar indisponibil' });
      }
      next(); // fail open only when gating explicitly disabled
    }
  };
}

/**
 * Middleware factory: require a boolean feature
 * Usage: router.post('/respond', requireFeature('can_respond_reviews'))
 */
function requireFeature(featureKey) {
  return (req, res, next) => {
    // Fail-closed: gating ON by default, bypass only if explicitly disabled
    if (process.env.TIER_GATING_DISABLED === 'true') return next();

    if (!req.tier) return res.status(500).json({ error: 'Tier info missing' });
    if (!req.tier.plan[featureKey]) {
      return res.status(403).json({
        error: 'upgrade_required',
        message: 'Aceasta functie necesita un plan superior.',
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
    // Fail-closed: gating ON by default, bypass only if explicitly disabled
    if (process.env.TIER_GATING_DISABLED === 'true') return next();

    if (!req.tier) return res.status(500).json({ error: 'Tier info missing' });
    const businessId = parseInt(req.params.businessId || req.params.bid);
    if (isNaN(businessId)) return res.status(400).json({ error: 'Invalid business ID' });
    try {
      const count = await countFn(pool, businessId);
      const limit = req.tier.plan[limitKey];
      const allowed = limit === null || count < limit;
      if (!allowed) {
        return res.status(403).json({
          error: 'limit_reached',
          message: `Ai atins limita de ${limit} pentru planul tau (${req.tier.plan.name}).`,
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
