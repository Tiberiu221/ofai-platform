-- Migration: Add description column to businesses table
-- Used in business-detail.ejs for the "Despre" section
ALTER TABLE businesses ADD COLUMN IF NOT EXISTS description TEXT;
