-- Migration 042: Update subscription plan tier values
-- Note: Updates tier values from original 033 seed to final production values.
-- If running on a fresh DB where 033 already has correct values, these UPDATEs are idempotent.
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
-- NOTE (9 Mar 2026): This line was SKIPPED when running on production because
-- migration 045_premium_gallery_64.sql (already applied) set max_gallery_images = 64.
-- Running this after 045 would regress the value from 64 → 32.
UPDATE subscription_plans SET
  max_gallery_images = 32
WHERE slug = 'premium';
