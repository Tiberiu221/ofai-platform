-- Migration 070: Add redemption_method column to offers
-- Allows business owners to choose the "Cum profiți de ofertă?" message
-- NULL = fallback to auto-detection (booking type + category), non-NULL = owner's choice
ALTER TABLE offers ADD COLUMN IF NOT EXISTS redemption_method TEXT DEFAULT NULL;
