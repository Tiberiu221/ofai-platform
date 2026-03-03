const { getBusinessTier } = require('../helpers/tiers');

/**
 * Middleware: attach tier info to req
 * Usage: router.use('/:businessId', attachTier(pool))
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
    // Feature flag: bypass gating if disabled
    if (process.env.TIER_GATING_ENABLED !== 'true') return next();

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
    // Feature flag: bypass gating if disabled
    if (process.env.TIER_GATING_ENABLED !== 'true') return next();

    if (!req.tier) return res.status(500).json({ error: 'Tier info missing' });
    const businessId = req.params.businessId || req.params.bid;
    try {
      const count = await countFn(req.app.get('pool'), parseInt(businessId));
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
