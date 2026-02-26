-- Migration 032: Display badge selection for reviews
-- Date: 26 Feb 2026
-- User selects a badge to display next to their name in reviews (or NULL for none)

ALTER TABLE users ADD COLUMN IF NOT EXISTS display_badge_id INTEGER REFERENCES badge_definitions(id) ON DELETE SET NULL;
