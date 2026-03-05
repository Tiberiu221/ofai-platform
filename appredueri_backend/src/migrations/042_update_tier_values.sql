-- Migration 042: Update subscription plan tier values
-- Date: 5 Mar 2026
--
-- Changes:
--   FREE:     can_upload_logo TRUE, can_upload_cover TRUE, promo codes 0→1, can_respond_reviews TRUE
--   STANDARD: max_active_offers 10→6, promo codes 3→1, has_promoted_placement TRUE
--   PREMIUM:  max_gallery_images NULL→32

-- FREE plan: more generous profile + engagement
UPDATE subscription_plans SET
  can_upload_logo = TRUE,
  can_upload_cover = TRUE,
  max_promo_codes_per_offer = 1,
  can_respond_reviews = TRUE
WHERE slug = 'free';

-- STANDARD plan: realistic limits + homepage placement
UPDATE subscription_plans SET
  max_active_offers = 6,
  max_promo_codes_per_offer = 1,
  has_promoted_placement = TRUE
WHERE slug = 'standard';

-- PREMIUM plan: cap gallery at 32 (was unlimited)
UPDATE subscription_plans SET
  max_gallery_images = 32
WHERE slug = 'premium';
