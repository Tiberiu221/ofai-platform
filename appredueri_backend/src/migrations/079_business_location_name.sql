-- Migration 079: Add name column to business_locations
-- Allows naming locations (e.g., "Sediu Central", "Punct de lucru Brașov")
-- Nullable for backward compatibility — existing locations simply have no name

ALTER TABLE business_locations
  ADD COLUMN IF NOT EXISTS name VARCHAR(100);
