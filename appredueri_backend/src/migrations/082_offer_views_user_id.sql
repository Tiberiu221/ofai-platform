-- Migration 082: Add user_id to offer_views for history tracking
-- Enables "Din Istoricul Tău" section on offer detail pages
-- Nullable — anonymous views still tracked without user_id

ALTER TABLE offer_views ADD COLUMN IF NOT EXISTS user_id INTEGER REFERENCES users(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_offer_views_user_id
  ON offer_views(user_id, viewed_at DESC)
  WHERE user_id IS NOT NULL;
