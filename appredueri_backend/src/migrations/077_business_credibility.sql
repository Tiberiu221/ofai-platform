-- Migration 077: Credibility fields for business detail page (Bolt DineOut-inspired)
ALTER TABLE businesses ADD COLUMN IF NOT EXISTS denumire_legala VARCHAR(255);
ALTER TABLE businesses ADD COLUMN IF NOT EXISTS cui VARCHAR(20);
ALTER TABLE businesses ADD COLUMN IF NOT EXISTS founded_year INTEGER;
