-- 076: GIN trigram index pe business_catalog_items.name pentru fuzzy search
-- Requires pg_trgm extension (enabled in migration 072).
-- Accelerates ci.name ILIKE '%query%' and similarity(ci.name, query) in catalog EXISTS subqueries.
CREATE INDEX IF NOT EXISTS idx_catalog_items_name_trgm
ON business_catalog_items USING gin(name gin_trgm_ops);
