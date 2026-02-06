-- Migration: Add last_active_at to users
-- Description: Tracks when the user was last active in the app
-- Date: 2026-02-06

-- 1. Add the column if it doesn't exist
ALTER TABLE users ADD COLUMN IF NOT EXISTS last_active_at TIMESTAMP WITH TIME ZONE DEFAULT NULL;

-- 2. Backfill existing users (assume they were active when created)
UPDATE users SET last_active_at = created_at WHERE last_active_at IS NULL;
