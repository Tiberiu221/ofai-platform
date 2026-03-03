-- 040: Fix competitor_blocking_enabled default (should be FALSE, not TRUE)
-- Only Premium businesses should have this enabled; migration 036 set DEFAULT TRUE

-- Disable for all non-Premium businesses
UPDATE businesses
SET competitor_blocking_enabled = FALSE
WHERE id NOT IN (
  SELECT bs.business_id
  FROM business_subscriptions bs
  JOIN subscription_plans sp ON sp.id = bs.plan_id
  WHERE bs.status IN ('active', 'trial')
    AND sp.slug = 'premium'
);

-- Fix default for future businesses
ALTER TABLE businesses ALTER COLUMN competitor_blocking_enabled SET DEFAULT FALSE;
