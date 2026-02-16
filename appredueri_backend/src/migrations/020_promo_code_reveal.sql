-- Migration 020: Promo Code Reveal system
-- Businesses can optionally add a promo code to offers.
-- Users reveal the code via a dedicated endpoint, logged for analytics.

-- 1. Add promo_code column to offers
ALTER TABLE offers ADD COLUMN IF NOT EXISTS promo_code VARCHAR(100);

-- 2. Code reveals tracking table
CREATE TABLE IF NOT EXISTS code_reveals (
  id SERIAL PRIMARY KEY,
  offer_id INTEGER NOT NULL REFERENCES offers(id) ON DELETE CASCADE,
  user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  viewer_ip VARCHAR(45),
  revealed_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_code_reveals_offer ON code_reveals(offer_id);
CREATE INDEX IF NOT EXISTS idx_code_reveals_user_offer ON code_reveals(user_id, offer_id);
