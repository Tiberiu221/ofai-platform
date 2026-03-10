-- Migration 055: Set Premium gallery images back to unlimited
-- Reverts the cap introduced in 042/045. NULL = unlimited.

UPDATE subscription_plans
SET max_gallery_images = NULL
WHERE slug = 'premium';
