-- Migration 075: Per-offer booking methods (override business-level)
-- When empty, offer inherits from business_booking_methods

CREATE TABLE IF NOT EXISTS offer_booking_methods (
  id SERIAL PRIMARY KEY,
  offer_id INTEGER NOT NULL REFERENCES offers(id) ON DELETE CASCADE,
  platform VARCHAR(30) NOT NULL,
  platform_label VARCHAR(100),
  value VARCHAR(500) NOT NULL,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_obm_offer ON offer_booking_methods(offer_id);
