-- Performance indexes for common query patterns
-- Uses CONCURRENTLY to avoid table locks

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_followed_biz_bid_created
  ON followed_businesses(business_id, created_at);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_offer_views_composite
  ON offer_views(business_id, offer_id, viewed_at);
