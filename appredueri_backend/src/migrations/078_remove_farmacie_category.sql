-- Migration 078: Remove Farmacie category (ID=9) and all associated data
-- Safe: all DELETE WHERE are idempotent (no-op if rows don't exist)

-- 1. Delete related data from tables with FK to businesses being deleted
DELETE FROM code_reveals WHERE offer_id IN (SELECT id FROM offers WHERE business_id IN (SELECT id FROM businesses WHERE category_id = 9));
DELETE FROM offer_views WHERE offer_id IN (SELECT id FROM offers WHERE business_id IN (SELECT id FROM businesses WHERE category_id = 9));
DELETE FROM favorite_offers WHERE offer_id IN (SELECT id FROM offers WHERE business_id IN (SELECT id FROM businesses WHERE category_id = 9));
DELETE FROM offer_locations WHERE offer_id IN (SELECT id FROM offers WHERE business_id IN (SELECT id FROM businesses WHERE category_id = 9));
DELETE FROM business_clicks WHERE business_id IN (SELECT id FROM businesses WHERE category_id = 9);
DELETE FROM business_views WHERE business_id IN (SELECT id FROM businesses WHERE category_id = 9);

-- 2. Delete offers of Farmacie businesses
DELETE FROM offers WHERE business_id IN (SELECT id FROM businesses WHERE category_id = 9);

-- 3. Delete subscription data for Farmacie businesses
DELETE FROM subscription_history WHERE business_id IN (SELECT id FROM businesses WHERE category_id = 9);
DELETE FROM business_subscriptions WHERE business_id IN (SELECT id FROM businesses WHERE category_id = 9);

-- 4. Delete other business-related data
DELETE FROM user_businesses WHERE business_id IN (SELECT id FROM businesses WHERE category_id = 9);
DELETE FROM business_hours WHERE business_id IN (SELECT id FROM businesses WHERE category_id = 9);
DELETE FROM business_images WHERE business_id IN (SELECT id FROM businesses WHERE category_id = 9);
DELETE FROM business_locations WHERE business_id IN (SELECT id FROM businesses WHERE category_id = 9);
DELETE FROM business_catalog_items WHERE category_id IN (SELECT id FROM business_catalog_categories WHERE business_id IN (SELECT id FROM businesses WHERE category_id = 9));
DELETE FROM business_catalog_categories WHERE business_id IN (SELECT id FROM businesses WHERE category_id = 9);
DELETE FROM business_booking_methods WHERE business_id IN (SELECT id FROM businesses WHERE category_id = 9);
DELETE FROM reviews WHERE business_id IN (SELECT id FROM businesses WHERE category_id = 9);
DELETE FROM reports WHERE target_type = 'business' AND target_id IN (SELECT id FROM businesses WHERE category_id = 9);
DELETE FROM deal_nominations WHERE business_id IN (SELECT id FROM businesses WHERE category_id = 9);
DELETE FROM followed_businesses WHERE business_id IN (SELECT id FROM businesses WHERE category_id = 9);

-- 5. Delete the businesses themselves
DELETE FROM businesses WHERE category_id = 9;

-- 6. Delete business requests with Farmacie category
DELETE FROM business_requests WHERE category_id = 9;

-- 7. Clean preferred_category_ids arrays in users
UPDATE users SET preferred_category_ids = array_remove(preferred_category_ids, 9)
WHERE preferred_category_ids IS NOT NULL AND 9 = ANY(preferred_category_ids);

-- 8. Delete the category (category_rankings CASCADE, saved_searches SET NULL)
DELETE FROM categories WHERE id = 9;
