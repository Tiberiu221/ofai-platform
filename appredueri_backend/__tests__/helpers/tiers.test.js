// Mock dependencies before requiring the module
jest.mock('../../src/services/cache', () => ({
  cached: jest.fn((key, ttl, fn) => fn()),
  invalidateGroup: jest.fn(),
}));

const { TIERS, normalisePlan, invalidateCache } = require('../../src/helpers/tiers');

describe('tiers helpers', () => {
  describe('TIERS constants', () => {
    it('has free, standard, premium slugs', () => {
      expect(TIERS.FREE).toBe('free');
      expect(TIERS.STANDARD).toBe('standard');
      expect(TIERS.PREMIUM).toBe('premium');
    });

    it('has exactly 3 tiers', () => {
      expect(Object.keys(TIERS)).toHaveLength(3);
    });
  });

  describe('normalisePlan', () => {
    it('normalizes a raw DB row', () => {
      const row = {
        id: 1,
        slug: 'free',
        name: 'Gratuit',
        price_monthly: 0,
        price_yearly: 0,
        max_active_offers: 3,
        max_gallery_images: 8,
        max_locations: 1,
        max_promo_codes_per_offer: 0,
        analytics_days: 7,
        can_respond_reviews: false,
        can_upload_logo: true,
        can_upload_cover: false,
        has_verified_badge: false,
        has_ai_summary: false,
        has_ai_suggested_responses: false,
        has_push_on_offer: false,
        has_custom_push: false,
        has_analytics_charts: false,
        has_analytics_export: false,
        has_competitive_insights: false,
        has_promoted_placement: false,
        has_search_priority: false,
        has_competitor_blocking: false,
        has_deal_nomination: false,
        has_booking: true,
        has_priority_support: false,
        has_concierge: false,
        has_custom_offer_image: false,
        badge_type: null,
        sort_order: 0,
      };

      const result = normalisePlan(row);
      expect(result.id).toBe(1);
      expect(result.slug).toBe('free');
      expect(result.name).toBe('Gratuit');
      expect(result.max_active_offers).toBe(3);
      expect(result.has_booking).toBe(true);
    });

    it('handles aliased JOIN rows (plan_id, plan_name)', () => {
      const row = {
        plan_id: 2,
        slug: 'standard',
        plan_name: 'Standard+',
        price_monthly: 4900,
      };

      const result = normalisePlan(row);
      expect(result.id).toBe(2);
      expect(result.name).toBe('Standard+');
    });

    it('prefers plan_id over id when both present', () => {
      const row = { plan_id: 5, id: 99, slug: 'premium' };
      const result = normalisePlan(row);
      expect(result.id).toBe(5);
    });
  });

  describe('invalidateCache', () => {
    it('does not throw', () => {
      expect(() => invalidateCache()).not.toThrow();
    });
  });
});
