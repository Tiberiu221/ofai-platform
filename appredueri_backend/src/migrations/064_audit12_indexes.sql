-- Migration 064: Audit #12 — Performance indexes
-- Adds missing indexes identified by performance profiler

-- 1. favorite_offers.created_at — used in trending badge queries (WHERE created_at > NOW() - 14 days)
CREATE INDEX IF NOT EXISTS idx_fav_offers_created_at
  ON favorite_offers(created_at);

-- 2. offers moderation_status + is_active composite — every public feed query filters on these
-- (existing partial index on pending_review doesn't help approved/auto_approved reads)
CREATE INDEX IF NOT EXISTS idx_offers_moderation_active
  ON offers(moderation_status, is_active)
  WHERE moderation_status IN ('approved', 'auto_approved') AND is_active = true;

-- 3. business_subscriptions(business_id, status) composite — used in every tier JOIN
-- (existing index on business_id alone doesn't cover the status filter)
CREATE INDEX IF NOT EXISTS idx_bsub_bid_status
  ON business_subscriptions(business_id, status);

-- 4. code_reveals.revealed_at — used in post-redemption review cron (24-48h window)
CREATE INDEX IF NOT EXISTS idx_code_reveals_revealed_at
  ON code_reveals(revealed_at);

-- 5. Drop redundant single-column index superseded by composite (offer_views)
-- idx_offer_views_bid is superseded by idx_offer_views_bid_date(business_id, viewed_at)
DROP INDEX IF EXISTS idx_offer_views_bid;
