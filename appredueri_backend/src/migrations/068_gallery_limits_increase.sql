-- Migration 068: Increase gallery image limits for Free and Standard tiers
-- Free: 3 → 8 images (let small businesses showcase their work)
-- Standard: 8 → 16 images

UPDATE subscription_plans
SET max_gallery_images = 8
WHERE slug = 'free';

UPDATE subscription_plans
SET max_gallery_images = 16
WHERE slug = 'standard';
