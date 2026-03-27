-- Migration 069: Add custom offer image feature flag (Premium only)
ALTER TABLE subscription_plans
  ADD COLUMN IF NOT EXISTS has_custom_offer_image BOOLEAN NOT NULL DEFAULT FALSE;

-- Only Premium tier gets custom offer images
UPDATE subscription_plans SET has_custom_offer_image = TRUE WHERE slug = 'premium';
