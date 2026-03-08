-- 053: Unified catalog — services, products, menu items
-- Single system with 'type' field: service, product, menu_item

CREATE TABLE IF NOT EXISTS business_catalog_categories (
  id          SERIAL PRIMARY KEY,
  business_id INTEGER NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  name        VARCHAR(200) NOT NULL,
  sort_order  INTEGER NOT NULL DEFAULT 0,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_catalog_categories_business
  ON business_catalog_categories(business_id, sort_order);

CREATE TABLE IF NOT EXISTS business_catalog_items (
  id               SERIAL PRIMARY KEY,
  business_id      INTEGER NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  category_id      INTEGER REFERENCES business_catalog_categories(id) ON DELETE SET NULL,
  type             VARCHAR(30) NOT NULL DEFAULT 'service'
                     CHECK (type IN ('service', 'product', 'menu_item')),
  name             VARCHAR(300) NOT NULL,
  description      TEXT,
  price            INTEGER,            -- bani (integer cents), NULL = la cerere
  price_label      VARCHAR(100),       -- free-form override: "de la 50 RON"
  duration_minutes INTEGER,            -- services only
  image_url        TEXT,
  is_active        BOOLEAN NOT NULL DEFAULT TRUE,
  sort_order       INTEGER NOT NULL DEFAULT 0,
  created_at       TIMESTAMPTZ DEFAULT NOW(),
  updated_at       TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_catalog_items_business
  ON business_catalog_items(business_id, is_active, sort_order);

CREATE INDEX IF NOT EXISTS idx_catalog_items_category
  ON business_catalog_items(category_id);
