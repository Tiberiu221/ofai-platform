-- Migration 024: Multi-city preferences
-- Changes preferred_city_id (single int) to preferred_city_ids (int array)
-- Keeps old column for backward compat during deploy

-- 1. Add new array column
ALTER TABLE users ADD COLUMN IF NOT EXISTS preferred_city_ids INTEGER[] DEFAULT '{}';

-- 2. Migrate existing data: copy preferred_city_id into preferred_city_ids array
UPDATE users SET preferred_city_ids = ARRAY[preferred_city_id] WHERE preferred_city_id IS NOT NULL AND (preferred_city_ids IS NULL OR preferred_city_ids = '{}');

-- Note: preferred_city_id column kept for now. Drop after verifying all code uses preferred_city_ids.
-- ALTER TABLE users DROP COLUMN preferred_city_id;
