-- Migration 081: Add discount_text for "special" discount type
-- discount_value (INTEGER) cannot store text like "GRATIS LA 2 ZILE"
-- discount_text stores the display text for special/text offers

ALTER TABLE offers ADD COLUMN IF NOT EXISTS discount_text VARCHAR(100);
