-- Migration 065: Enhanced search — pg_trgm + unaccent extensions + trigram indexes
-- Run manually on Railway: psql $DATABASE_URL -f src/migrations/065_search_extensions_indexes.sql

-- Enable extensions
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE EXTENSION IF NOT EXISTS unaccent;

-- Immutable wrapper for unaccent (required for index expressions — unaccent() is STABLE, not IMMUTABLE)
CREATE OR REPLACE FUNCTION f_unaccent(text)
RETURNS text AS $$
  SELECT public.unaccent('public.unaccent', $1)
$$ LANGUAGE sql IMMUTABLE PARALLEL SAFE STRICT;

-- GIN trigram indexes with unaccent + lower for fuzzy + diacritic-insensitive search
DROP INDEX IF EXISTS idx_businesses_name_trgm;
CREATE INDEX idx_businesses_name_trgm ON businesses USING gin(f_unaccent(lower(name)) gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_offers_title_trgm ON offers USING gin(f_unaccent(lower(title)) gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_offers_desc_trgm ON offers USING gin(f_unaccent(lower(description)) gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_categories_name_trgm ON categories USING gin(f_unaccent(lower(name)) gin_trgm_ops);
