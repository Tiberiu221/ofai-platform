-- Migration 045: Increase premium gallery limit from 32 to 64
-- Date: 6 Mar 2026

UPDATE subscription_plans SET
  max_gallery_images = 64
WHERE slug = 'premium';
