-- Migration 026: Business verified badge + user profile settings
-- Date: 20 Feb 2026

-- Business verification (admin-controlled badge like Instagram/X)
ALTER TABLE businesses ADD COLUMN IF NOT EXISTS is_verified BOOLEAN DEFAULT FALSE;
ALTER TABLE businesses ADD COLUMN IF NOT EXISTS verified_at TIMESTAMP WITH TIME ZONE;

CREATE INDEX IF NOT EXISTS idx_businesses_verified ON businesses(is_verified) WHERE is_verified = TRUE;

-- User profile picture visibility in reviews
ALTER TABLE users ADD COLUMN IF NOT EXISTS show_picture_in_reviews BOOLEAN DEFAULT TRUE;
