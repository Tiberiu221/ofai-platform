-- Migration 046: Consolidate schema from legacy migrations directory
-- These tables/columns were created by unnumbered migrations in /migrations/
-- but never replicated in /src/migrations/. This migration ensures a fresh
-- database install from src/migrations/ alone will have the complete schema.
-- All statements use IF NOT EXISTS / ADD COLUMN IF NOT EXISTS for idempotency.

-- ── review_responses (used in web.js:1135, 1946, 2720, business-portal.js:1027) ──
CREATE TABLE IF NOT EXISTS review_responses (
  id SERIAL PRIMARY KEY,
  review_id INTEGER NOT NULL REFERENCES reviews(id) ON DELETE CASCADE,
  business_id INTEGER NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  response_text TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_review_responses_review ON review_responses(review_id);

-- ── review_summaries (used in web.js:2041) ──
CREATE TABLE IF NOT EXISTS review_summaries (
  id SERIAL PRIMARY KEY,
  business_id INTEGER NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  summary TEXT,
  generated_at TIMESTAMPTZ DEFAULT NOW(),
  review_count INTEGER DEFAULT 0,
  avg_rating NUMERIC(3,2),
  UNIQUE(business_id)
);

-- ── badge_definitions + user_badges (used in web.js:1134) ──
CREATE TABLE IF NOT EXISTS badge_definitions (
  id SERIAL PRIMARY KEY,
  slug VARCHAR(50) UNIQUE NOT NULL,
  name VARCHAR(100) NOT NULL,
  description TEXT,
  icon_url VARCHAR(500),
  points_required INTEGER DEFAULT 0,
  category VARCHAR(50) DEFAULT 'general',
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS user_badges (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  badge_id INTEGER NOT NULL REFERENCES badge_definitions(id) ON DELETE CASCADE,
  awarded_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, badge_id)
);
CREATE INDEX IF NOT EXISTS idx_user_badges_badge_id ON user_badges(badge_id);

-- ── Missing columns on businesses ──
ALTER TABLE businesses ADD COLUMN IF NOT EXISTS description TEXT;
ALTER TABLE businesses ADD COLUMN IF NOT EXISTS is_verified BOOLEAN DEFAULT FALSE;
ALTER TABLE businesses ADD COLUMN IF NOT EXISTS verified_at TIMESTAMPTZ;

-- ── Missing columns on users ──
ALTER TABLE users ADD COLUMN IF NOT EXISTS show_picture_in_reviews BOOLEAN DEFAULT TRUE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS display_badge_id INTEGER REFERENCES badge_definitions(id) ON DELETE SET NULL;

-- ── Booking columns on business_locations ──
ALTER TABLE business_locations ADD COLUMN IF NOT EXISTS booking_type VARCHAR(20);
ALTER TABLE business_locations ADD COLUMN IF NOT EXISTS booking_phone VARCHAR(20);
ALTER TABLE business_locations ADD COLUMN IF NOT EXISTS booking_whatsapp VARCHAR(20);
ALTER TABLE business_locations ADD COLUMN IF NOT EXISTS booking_url VARCHAR(500);
ALTER TABLE business_locations ADD COLUMN IF NOT EXISTS booking_instructions TEXT;
