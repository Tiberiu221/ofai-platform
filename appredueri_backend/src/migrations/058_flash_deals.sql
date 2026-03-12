-- Migration 058: Flash Deals
-- Adds flash_expires_at column to offers for time-limited flash deals

ALTER TABLE offers ADD COLUMN IF NOT EXISTS flash_expires_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_offers_flash_expires ON offers(flash_expires_at)
  WHERE flash_expires_at IS NOT NULL;
