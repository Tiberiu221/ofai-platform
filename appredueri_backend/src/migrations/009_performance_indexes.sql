-- Migration: Performance Indexes
-- Description: Adaugă indexuri pentru queries frecvente și performanță îmbunătățită
-- Run: psql $DATABASE_URL -f src/migrations/009_performance_indexes.sql

-- ============================================
-- BUSINESSES TABLE INDEXES
-- ============================================

-- Index pentru filtrare după oraș (foarte frecvent)
CREATE INDEX IF NOT EXISTS idx_businesses_city_id 
ON businesses(city_id);

-- Index pentru filtrare după categorie
CREATE INDEX IF NOT EXISTS idx_businesses_category_id 
ON businesses(category_id);

-- Index compus pentru filtrare oraș + categorie (query comun)
CREATE INDEX IF NOT EXISTS idx_businesses_city_category 
ON businesses(city_id, category_id);

-- Index pentru căutare după nume (pentru autocomplete/search)
CREATE INDEX IF NOT EXISTS idx_businesses_name_trgm 
ON businesses USING gin(name gin_trgm_ops);

-- Dacă extensia pg_trgm nu e instalată, folosim un index normal
-- CREATE INDEX IF NOT EXISTS idx_businesses_name ON businesses(name);

-- ============================================
-- OFFERS TABLE INDEXES
-- ============================================

-- Index pentru filtrare oferter active
CREATE INDEX IF NOT EXISTS idx_offers_is_active 
ON offers(is_active) 
WHERE is_active = true;

-- Index pentru business_id (join frecvent)
CREATE INDEX IF NOT EXISTS idx_offers_business_id 
ON offers(business_id);

-- Index compus pentru oferte active per business
CREATE INDEX IF NOT EXISTS idx_offers_business_active 
ON offers(business_id, is_active) 
WHERE is_active = true;

-- Index pentru date (oferte în perioada curentă)
CREATE INDEX IF NOT EXISTS idx_offers_dates 
ON offers(start_date, end_date);

-- ============================================
-- BUSINESS_LOCATIONS TABLE INDEXES
-- ============================================

-- Index pentru business_id
CREATE INDEX IF NOT EXISTS idx_business_locations_business_id 
ON business_locations(business_id);

-- Index pentru city_id
CREATE INDEX IF NOT EXISTS idx_business_locations_city_id 
ON business_locations(city_id);

-- Index pentru coordonate (pentru query-uri geo)
CREATE INDEX IF NOT EXISTS idx_business_locations_coords 
ON business_locations(lat, lng) 
WHERE lat IS NOT NULL AND lng IS NOT NULL;

-- ============================================
-- FAVORITES TABLE INDEXES
-- ============================================

-- Index pentru user_id (listare favorite user)
CREATE INDEX IF NOT EXISTS idx_favorites_user_id 
ON favorites(user_id);

-- Index pentru business_id (count favorites per business)
CREATE INDEX IF NOT EXISTS idx_favorites_business_id 
ON favorites(business_id);

-- ============================================
-- REVIEWS TABLE INDEXES
-- ============================================

-- Index pentru business_id (listare reviews)
CREATE INDEX IF NOT EXISTS idx_reviews_business_id 
ON reviews(business_id);

-- Index pentru user_id
CREATE INDEX IF NOT EXISTS idx_reviews_user_id 
ON reviews(user_id);

-- Index pentru rating (pentru calcul average optimizat)
CREATE INDEX IF NOT EXISTS idx_reviews_business_rating 
ON reviews(business_id, rating);

-- ============================================
-- SUBSCRIPTIONS TABLE INDEXES
-- ============================================

-- Index pentru user subscriptions
CREATE INDEX IF NOT EXISTS idx_subscriptions_user_id 
ON subscriptions(user_id);

-- Index pentru business subscriptions
CREATE INDEX IF NOT EXISTS idx_subscriptions_business_id 
ON subscriptions(business_id);

-- ============================================
-- USERS TABLE INDEXES
-- ============================================

-- Index pentru email (login lookup)
CREATE INDEX IF NOT EXISTS idx_users_email 
ON users(email);

-- Index pentru role (pentru queries admin)
CREATE INDEX IF NOT EXISTS idx_users_role 
ON users(role);

-- ============================================
-- PASSWORD RESET TOKENS INDEXES
-- ============================================

-- Index pentru lookup rapid token valid
CREATE INDEX IF NOT EXISTS idx_password_reset_tokens_lookup 
ON password_reset_tokens(user_id, token, expires_at) 
WHERE used_at IS NULL;

-- ============================================
-- OFFER_LOCATIONS TABLE INDEXES (dacă există)
-- ============================================

CREATE INDEX IF NOT EXISTS idx_offer_locations_offer_id 
ON offer_locations(offer_id);

CREATE INDEX IF NOT EXISTS idx_offer_locations_location_id 
ON offer_locations(location_id);

-- ============================================
-- ANALYZE pentru a actualiza statisticile
-- ============================================
ANALYZE businesses;
ANALYZE offers;
ANALYZE business_locations;
ANALYZE favorites;
ANALYZE reviews;
ANALYZE subscriptions;
ANALYZE users;

-- ============================================
-- Instalare extensie pg_trgm pentru full-text search (opțional)
-- Rulează separat cu superuser dacă e necesar:
-- CREATE EXTENSION IF NOT EXISTS pg_trgm;
-- ============================================
