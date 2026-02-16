-- Migration 021: Multi promo codes with toggle
-- Replaces single offers.promo_code column with a dedicated table.

CREATE TABLE IF NOT EXISTS promo_codes (
  id SERIAL PRIMARY KEY,
  offer_id INTEGER NOT NULL REFERENCES offers(id) ON DELETE CASCADE,
  code VARCHAR(100) NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_promo_codes_offer ON promo_codes(offer_id);
CREATE INDEX IF NOT EXISTS idx_promo_codes_active ON promo_codes(offer_id, is_active) WHERE is_active = TRUE;

-- Migrate existing data from offers.promo_code into the new table
INSERT INTO promo_codes (offer_id, code, is_active)
SELECT id, promo_code, TRUE
FROM offers
WHERE promo_code IS NOT NULL AND promo_code != '';

-- Add per-code tracking to code_reveals
ALTER TABLE code_reveals ADD COLUMN IF NOT EXISTS promo_code_id INTEGER REFERENCES promo_codes(id) ON DELETE SET NULL;

-- NOTE: offers.promo_code column is kept temporarily for rollback safety.
-- Drop it in a follow-up migration (022) after confirming the new system works.
