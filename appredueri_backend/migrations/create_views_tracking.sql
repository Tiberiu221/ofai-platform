-- Migration: Create view tracking tables
-- Description: Tracks page views for businesses and offers (analytics)
-- Date: 2026-02-07

CREATE TABLE IF NOT EXISTS business_views (
    id BIGSERIAL PRIMARY KEY,
    business_id INTEGER NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
    viewer_ip VARCHAR(45),
    user_agent VARCHAR(500),
    viewed_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_business_views_biz_date ON business_views(business_id, viewed_at);

CREATE TABLE IF NOT EXISTS offer_views (
    id BIGSERIAL PRIMARY KEY,
    offer_id INTEGER NOT NULL REFERENCES offers(id) ON DELETE CASCADE,
    business_id INTEGER NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
    viewer_ip VARCHAR(45),
    user_agent VARCHAR(500),
    viewed_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_offer_views_offer_date ON offer_views(offer_id, viewed_at);
CREATE INDEX IF NOT EXISTS idx_offer_views_biz_date ON offer_views(business_id, viewed_at);
