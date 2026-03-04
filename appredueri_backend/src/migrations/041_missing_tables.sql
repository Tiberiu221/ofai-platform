-- Migration 041: Create missing tables that exist in production but lack CREATE TABLE migrations
-- Date: 4 Mar 2026
-- These tables were created in migrations 001-005 (missing from repo) or manually.
-- Safe to run: uses IF NOT EXISTS — no-op on production where tables already exist.

-- 1. user_points — gamification total points per user
CREATE TABLE IF NOT EXISTS user_points (
  user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  total_points INTEGER NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. favorite_offers — user's saved/bookmarked offers
CREATE TABLE IF NOT EXISTS favorite_offers (
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  offer_id INTEGER NOT NULL REFERENCES offers(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (user_id, offer_id)
);

-- 3. followed_businesses — user subscriptions/follows to businesses
CREATE TABLE IF NOT EXISTS followed_businesses (
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  business_id INTEGER NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (user_id, business_id)
);

-- 4. offer_locations — junction table linking offers to specific business locations
CREATE TABLE IF NOT EXISTS offer_locations (
  offer_id INTEGER NOT NULL REFERENCES offers(id) ON DELETE CASCADE,
  location_id INTEGER NOT NULL REFERENCES business_locations(id) ON DELETE CASCADE,
  PRIMARY KEY (offer_id, location_id)
);
