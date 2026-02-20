-- Migration 029: Add ON DELETE CASCADE to key foreign keys
-- This reduces the need for manual multi-table DELETE chains in admin/deletion routes
-- Safe: uses DROP CONSTRAINT IF EXISTS + ADD CONSTRAINT pattern

-- business_images → businesses
ALTER TABLE business_images DROP CONSTRAINT IF EXISTS business_images_business_id_fkey;
ALTER TABLE business_images ADD CONSTRAINT business_images_business_id_fkey
  FOREIGN KEY (business_id) REFERENCES businesses(id) ON DELETE CASCADE;

-- business_locations → businesses
ALTER TABLE business_locations DROP CONSTRAINT IF EXISTS business_locations_business_id_fkey;
ALTER TABLE business_locations ADD CONSTRAINT business_locations_business_id_fkey
  FOREIGN KEY (business_id) REFERENCES businesses(id) ON DELETE CASCADE;

-- followed_businesses → businesses
ALTER TABLE followed_businesses DROP CONSTRAINT IF EXISTS followed_businesses_business_id_fkey;
ALTER TABLE followed_businesses ADD CONSTRAINT followed_businesses_business_id_fkey
  FOREIGN KEY (business_id) REFERENCES businesses(id) ON DELETE CASCADE;

-- business_clicks → businesses (if FK exists)
DO $$ BEGIN
  ALTER TABLE business_clicks DROP CONSTRAINT IF EXISTS business_clicks_business_id_fkey;
  ALTER TABLE business_clicks ADD CONSTRAINT business_clicks_business_id_fkey
    FOREIGN KEY (business_id) REFERENCES businesses(id) ON DELETE CASCADE;
EXCEPTION WHEN undefined_table THEN NULL;
END $$;

-- user_businesses → businesses
ALTER TABLE user_businesses DROP CONSTRAINT IF EXISTS user_businesses_business_id_fkey;
ALTER TABLE user_businesses ADD CONSTRAINT user_businesses_business_id_fkey
  FOREIGN KEY (business_id) REFERENCES businesses(id) ON DELETE CASCADE;

-- reviews → businesses (SET NULL on delete — keep orphaned reviews)
ALTER TABLE reviews DROP CONSTRAINT IF EXISTS reviews_business_id_fkey;
ALTER TABLE reviews ADD CONSTRAINT reviews_business_id_fkey
  FOREIGN KEY (business_id) REFERENCES businesses(id) ON DELETE SET NULL;

-- promo_codes → offers
ALTER TABLE promo_codes DROP CONSTRAINT IF EXISTS promo_codes_offer_id_fkey;
ALTER TABLE promo_codes ADD CONSTRAINT promo_codes_offer_id_fkey
  FOREIGN KEY (offer_id) REFERENCES offers(id) ON DELETE CASCADE;

-- code_reveals → offers
ALTER TABLE code_reveals DROP CONSTRAINT IF EXISTS code_reveals_offer_id_fkey;
ALTER TABLE code_reveals ADD CONSTRAINT code_reveals_offer_id_fkey
  FOREIGN KEY (offer_id) REFERENCES offers(id) ON DELETE CASCADE;

-- review_responses → reviews
ALTER TABLE review_responses DROP CONSTRAINT IF EXISTS review_responses_review_id_fkey;
ALTER TABLE review_responses ADD CONSTRAINT review_responses_review_id_fkey
  FOREIGN KEY (review_id) REFERENCES reviews(id) ON DELETE CASCADE;

-- offers → businesses
ALTER TABLE offers DROP CONSTRAINT IF EXISTS offers_business_id_fkey;
ALTER TABLE offers ADD CONSTRAINT offers_business_id_fkey
  FOREIGN KEY (business_id) REFERENCES businesses(id) ON DELETE CASCADE;
