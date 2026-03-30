-- 072: Enable pg_trgm extension and create trigram indexes for fuzzy search
-- On Railway, the connected user is the database owner, so CREATE EXTENSION works.

CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- Trigram GIN indexes for fuzzy substring matching
-- idx_businesses_name_trgm already exists from migration 009 (no-op if present)
CREATE INDEX IF NOT EXISTS idx_businesses_name_trgm
ON businesses USING gin(name gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_offers_title_trgm
ON offers USING gin(title gin_trgm_ops);

-- Category name index for fuzzy category search
CREATE INDEX IF NOT EXISTS idx_categories_name_trgm
ON categories USING gin(name gin_trgm_ops);
