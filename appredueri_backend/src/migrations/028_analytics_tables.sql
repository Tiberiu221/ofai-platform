-- Migration 028: Create analytics tables (business_views + offer_views)
-- These tables already exist in production (created manually), this migration ensures reproducibility
-- Safe to run: uses IF NOT EXISTS

-- Business page view tracking
CREATE TABLE IF NOT EXISTS business_views (
  id SERIAL PRIMARY KEY,
  business_id INTEGER REFERENCES businesses(id) ON DELETE CASCADE,
  viewer_ip VARCHAR(45),
  user_agent VARCHAR(500),
  viewed_at TIMESTAMPTZ DEFAULT NOW()
);

-- Offer page view tracking
CREATE TABLE IF NOT EXISTS offer_views (
  id SERIAL PRIMARY KEY,
  offer_id INTEGER REFERENCES offers(id) ON DELETE CASCADE,
  viewer_ip VARCHAR(45),
  user_agent VARCHAR(500),
  viewed_at TIMESTAMPTZ DEFAULT NOW()
);

-- Performance indexes for analytics queries
CREATE INDEX IF NOT EXISTS idx_business_views_bid_date ON business_views(business_id, viewed_at);
CREATE INDEX IF NOT EXISTS idx_offer_views_oid_date ON offer_views(offer_id, viewed_at);

-- Composite index for click analytics (action_type filtering + date range)
CREATE INDEX IF NOT EXISTS idx_business_clicks_composite ON business_clicks(business_id, action_type, created_at);
