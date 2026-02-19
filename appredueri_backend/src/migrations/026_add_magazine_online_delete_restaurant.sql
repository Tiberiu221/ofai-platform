-- Migration 026: Add "Magazine Online" category + Delete "Restaurant" category and all associated data
-- Date: 2026-02-19
-- IMPORTANT: Run inside transaction for safety

BEGIN;

-- Step 1: Add "Magazine Online" category (guard against duplicates)
INSERT INTO categories (name)
SELECT 'Magazine Online'
WHERE NOT EXISTS (SELECT 1 FROM categories WHERE name = 'Magazine Online');

-- Step 2: Delete all Restaurant data (FK-safe order, deepest children first)
-- Restaurant category_id = 5, all 40 businesses are source='scraped', 0 Cloudinary images

-- 2a. code_reveals (via offers → businesses)
DELETE FROM code_reveals
WHERE offer_id IN (
  SELECT o.id FROM offers o
  JOIN businesses b ON o.business_id = b.id
  WHERE b.category_id = (SELECT id FROM categories WHERE name = 'Restaurant')
);

-- 2b. promo_codes (via offers → businesses)
DELETE FROM promo_codes
WHERE offer_id IN (
  SELECT o.id FROM offers o
  JOIN businesses b ON o.business_id = b.id
  WHERE b.category_id = (SELECT id FROM categories WHERE name = 'Restaurant')
);

-- 2c. favorite_offers (via offers → businesses)
DELETE FROM favorite_offers
WHERE offer_id IN (
  SELECT o.id FROM offers o
  JOIN businesses b ON o.business_id = b.id
  WHERE b.category_id = (SELECT id FROM categories WHERE name = 'Restaurant')
);

-- 2d. business_clicks
DELETE FROM business_clicks
WHERE business_id IN (
  SELECT id FROM businesses WHERE category_id = (SELECT id FROM categories WHERE name = 'Restaurant')
);

-- 2e. review_responses (via reviews → businesses)
DELETE FROM review_responses
WHERE review_id IN (
  SELECT r.id FROM reviews r
  JOIN businesses b ON r.business_id = b.id
  WHERE b.category_id = (SELECT id FROM categories WHERE name = 'Restaurant')
);

-- 2f. review_summaries
DELETE FROM review_summaries
WHERE business_id IN (
  SELECT id FROM businesses WHERE category_id = (SELECT id FROM categories WHERE name = 'Restaurant')
);

-- 2g. reviews
DELETE FROM reviews
WHERE business_id IN (
  SELECT id FROM businesses WHERE category_id = (SELECT id FROM categories WHERE name = 'Restaurant')
);

-- 2h. offer_requests (via businesses)
DELETE FROM offer_requests
WHERE business_id IN (
  SELECT id FROM businesses WHERE category_id = (SELECT id FROM categories WHERE name = 'Restaurant')
);

-- 2i. offers
DELETE FROM offers
WHERE business_id IN (
  SELECT id FROM businesses WHERE category_id = (SELECT id FROM categories WHERE name = 'Restaurant')
);

-- 2j. business_images
DELETE FROM business_images
WHERE business_id IN (
  SELECT id FROM businesses WHERE category_id = (SELECT id FROM categories WHERE name = 'Restaurant')
);

-- 2k. business_locations
DELETE FROM business_locations
WHERE business_id IN (
  SELECT id FROM businesses WHERE category_id = (SELECT id FROM categories WHERE name = 'Restaurant')
);

-- 2l. followed_businesses
DELETE FROM followed_businesses
WHERE business_id IN (
  SELECT id FROM businesses WHERE category_id = (SELECT id FROM categories WHERE name = 'Restaurant')
);

-- 2m. user_businesses
DELETE FROM user_businesses
WHERE business_id IN (
  SELECT id FROM businesses WHERE category_id = (SELECT id FROM categories WHERE name = 'Restaurant')
);

-- 2n. business_requests — nullify category reference (don't delete the requests)
UPDATE business_requests
SET category_id = NULL
WHERE category_id = (SELECT id FROM categories WHERE name = 'Restaurant');

-- 2o. businesses
DELETE FROM businesses
WHERE category_id = (SELECT id FROM categories WHERE name = 'Restaurant');

-- 2p. category itself
DELETE FROM categories WHERE name = 'Restaurant';

COMMIT;

-- DOWN (manual rollback — data is irrecoverable without backup):
-- INSERT INTO categories (name) VALUES ('Restaurant');
-- DELETE FROM categories WHERE name = 'Magazine Online';
