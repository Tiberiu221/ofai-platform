CREATE TABLE IF NOT EXISTS collections (
  id SERIAL PRIMARY KEY,
  title VARCHAR(200) NOT NULL,
  description TEXT,
  image_url TEXT,
  is_active BOOLEAN DEFAULT TRUE,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS collection_offers (
  collection_id INTEGER NOT NULL REFERENCES collections(id) ON DELETE CASCADE,
  offer_id INTEGER NOT NULL REFERENCES offers(id) ON DELETE CASCADE,
  sort_order INTEGER DEFAULT 0,
  PRIMARY KEY (collection_id, offer_id)
);

CREATE INDEX IF NOT EXISTS idx_collection_offers_collection ON collection_offers(collection_id);
