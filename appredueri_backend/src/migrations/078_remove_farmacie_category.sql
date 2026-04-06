-- Migration 078: Remove Farmacie category (ID=10) and all associated data
-- NOTE: Farmacie is ID=10 in production DB (NOT id=9 from hardcoded categories.js)
-- Already executed on production Railway DB on 2026-04-06

-- This migration is idempotent — safe to re-run (DELETE WHERE no-ops if rows gone)

DELETE FROM code_reveals WHERE offer_id IN (SELECT id FROM offers WHERE business_id IN (SELECT id FROM businesses WHERE category_id = 10));
DELETE FROM offer_views WHERE offer_id IN (SELECT id FROM offers WHERE business_id IN (SELECT id FROM businesses WHERE category_id = 10));
DELETE FROM favorite_offers WHERE offer_id IN (SELECT id FROM offers WHERE business_id IN (SELECT id FROM businesses WHERE category_id = 10));
DELETE FROM offer_locations WHERE offer_id IN (SELECT id FROM offers WHERE business_id IN (SELECT id FROM businesses WHERE category_id = 10));
DELETE FROM offer_booking_methods WHERE offer_id IN (SELECT id FROM offers WHERE business_id IN (SELECT id FROM businesses WHERE category_id = 10));
DELETE FROM offers WHERE business_id IN (SELECT id FROM businesses WHERE category_id = 10);
DELETE FROM business_clicks WHERE business_id IN (SELECT id FROM businesses WHERE category_id = 10);
DELETE FROM business_views WHERE business_id IN (SELECT id FROM businesses WHERE category_id = 10);
DELETE FROM subscription_history WHERE business_id IN (SELECT id FROM businesses WHERE category_id = 10);
DELETE FROM business_subscriptions WHERE business_id IN (SELECT id FROM businesses WHERE category_id = 10);
DELETE FROM user_businesses WHERE business_id IN (SELECT id FROM businesses WHERE category_id = 10);
DELETE FROM business_images WHERE business_id IN (SELECT id FROM businesses WHERE category_id = 10);
DELETE FROM business_booking_methods WHERE business_id IN (SELECT id FROM businesses WHERE category_id = 10);
DELETE FROM reviews WHERE business_id IN (SELECT id FROM businesses WHERE category_id = 10);
DELETE FROM followed_businesses WHERE business_id IN (SELECT id FROM businesses WHERE category_id = 10);
DELETE FROM deal_nominations WHERE business_id IN (SELECT id FROM businesses WHERE category_id = 10);
DELETE FROM reports WHERE target_type = 'business' AND target_id IN (SELECT id FROM businesses WHERE category_id = 10);
DELETE FROM business_catalog_items WHERE category_id IN (SELECT id FROM business_catalog_categories WHERE business_id IN (SELECT id FROM businesses WHERE category_id = 10));
DELETE FROM business_catalog_categories WHERE business_id IN (SELECT id FROM businesses WHERE category_id = 10);
DELETE FROM business_locations WHERE business_id IN (SELECT id FROM businesses WHERE category_id = 10);
DELETE FROM businesses WHERE category_id = 10;
DELETE FROM business_requests WHERE category_id = 10;
UPDATE users SET preferred_category_ids = array_remove(preferred_category_ids, 10) WHERE preferred_category_ids IS NOT NULL AND 10 = ANY(preferred_category_ids);
DELETE FROM categories WHERE id = 10;
