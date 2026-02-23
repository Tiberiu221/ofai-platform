-- Migration 032: Add missing schema elements
-- Date: 23 Feb 2026
-- Covers: offer_views.business_id, points_history table, deal-of-day columns on offers
-- Safe to run: uses IF NOT EXISTS / ADD COLUMN IF NOT EXISTS

-- 1. Add business_id to offer_views (already exists in production, ensuring reproducibility)
ALTER TABLE offer_views ADD COLUMN IF NOT EXISTS business_id INTEGER REFERENCES businesses(id) ON DELETE CASCADE;
CREATE INDEX IF NOT EXISTS idx_offer_views_bid ON offer_views(business_id);

-- 2. Create points_history table (used by gamification and GDPR deletion)
CREATE TABLE IF NOT EXISTS points_history (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  points_amount INTEGER NOT NULL DEFAULT 0,
  action_type VARCHAR(50) NOT NULL,
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_points_history_user_id ON points_history(user_id);

-- 3. Add deal-of-day columns to offers (used by deal-of-day feature)
ALTER TABLE offers ADD COLUMN IF NOT EXISTS is_deal_of_day BOOLEAN DEFAULT FALSE;
ALTER TABLE offers ADD COLUMN IF NOT EXISTS deal_of_day_date DATE;
ALTER TABLE offers ADD COLUMN IF NOT EXISTS max_reveals INTEGER;
