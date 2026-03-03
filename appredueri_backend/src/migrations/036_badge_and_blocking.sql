-- Migration 036: Badge type + competitor blocking preference
-- Plans 10 (competitor blocking) + 12 (premium badge)

-- Business preference for competitor blocking (opt-out capability)
-- Defaults to TRUE: Premium businesses get blocking automatically, can opt out via toggle
ALTER TABLE businesses
  ADD COLUMN IF NOT EXISTS competitor_blocking_enabled BOOLEAN NOT NULL DEFAULT TRUE;

-- Cached subscription badge type for fast reads (avoids JOIN on every query)
-- Values: NULL (free/no badge), 'verified' (standard), 'premium' (premium)
ALTER TABLE businesses
  ADD COLUMN IF NOT EXISTS subscription_badge_type VARCHAR(20) DEFAULT NULL;

-- Index for filtering by badge type
CREATE INDEX IF NOT EXISTS idx_businesses_badge_type
  ON businesses(subscription_badge_type)
  WHERE subscription_badge_type IS NOT NULL;

-- Backfill from existing subscriptions (after 033 has run)
UPDATE businesses b
SET subscription_badge_type = sp.badge_type
FROM business_subscriptions bs
JOIN subscription_plans sp ON sp.id = bs.plan_id
WHERE bs.business_id = b.id
  AND bs.status IN ('active', 'trial')
  AND sp.badge_type IS NOT NULL;
