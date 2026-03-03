-- 038: Add plain index on business_subscriptions(business_id)
-- Existing partial indexes only cover active/trial status.
-- This covers all-status queries (history, cancelled, Stripe lookup).
CREATE INDEX IF NOT EXISTS idx_business_subscriptions_bid
  ON business_subscriptions(business_id);
