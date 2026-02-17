-- Migration 023: Fix indexes from migration 009
-- Migration 009 created indexes on wrong table names (subscriptions/favorites vs followed_businesses/favorite_offers)
-- This migration creates the correct indexes

-- Drop incorrect indexes if they exist (from migration 009)
DROP INDEX IF EXISTS idx_subscriptions_user_id;
DROP INDEX IF EXISTS idx_subscriptions_business_id;
DROP INDEX IF EXISTS idx_favorites_user_id;
DROP INDEX IF EXISTS idx_favorites_offer_id;

-- Create correct indexes
CREATE INDEX IF NOT EXISTS idx_followed_businesses_user_id ON followed_businesses(user_id);
CREATE INDEX IF NOT EXISTS idx_followed_businesses_business_id ON followed_businesses(business_id);
CREATE INDEX IF NOT EXISTS idx_favorite_offers_user_id ON favorite_offers(user_id);
CREATE INDEX IF NOT EXISTS idx_favorite_offers_offer_id ON favorite_offers(offer_id);

-- Additional useful indexes found missing in audit
CREATE INDEX IF NOT EXISTS idx_offers_start_date ON offers(start_date);
CREATE INDEX IF NOT EXISTS idx_offers_discount_value ON offers(discount_value);
CREATE INDEX IF NOT EXISTS idx_business_clicks_action_type ON business_clicks(action_type);
