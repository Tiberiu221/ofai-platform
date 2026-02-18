-- Migration 025: Google OAuth support
-- Adds google_id for account linking and profile_picture_url for Google profile photos

ALTER TABLE users ADD COLUMN IF NOT EXISTS google_id VARCHAR(255) UNIQUE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS profile_picture_url TEXT;
