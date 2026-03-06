-- Migration 044: Add maps_url column to business_locations
-- Date: 6 Mar 2026
-- Purpose: Store Google Maps link alongside coordinates for each location
-- Safe to run: uses IF NOT EXISTS via ADD COLUMN IF NOT EXISTS

ALTER TABLE business_locations ADD COLUMN IF NOT EXISTS maps_url TEXT;
