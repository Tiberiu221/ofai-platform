-- 067: Blog / Content System
-- blog_categories + blog_posts tables for editorial content + SEO

CREATE TABLE blog_categories (
  id SERIAL PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  slug VARCHAR(100) NOT NULL UNIQUE,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE blog_posts (
  id SERIAL PRIMARY KEY,
  slug VARCHAR(255) NOT NULL UNIQUE,
  title VARCHAR(300) NOT NULL,
  excerpt TEXT,
  content TEXT NOT NULL,
  image_url TEXT,
  category_id INTEGER REFERENCES blog_categories(id) ON DELETE SET NULL,
  author_name VARCHAR(100) DEFAULT 'Echipa OFAI',
  is_published BOOLEAN DEFAULT FALSE,
  published_at TIMESTAMPTZ,
  meta_title VARCHAR(200),
  meta_description VARCHAR(320),
  view_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_blog_posts_slug ON blog_posts(slug);
CREATE INDEX idx_blog_posts_published ON blog_posts(is_published, published_at DESC);
CREATE INDEX idx_blog_posts_category ON blog_posts(category_id);

-- Seed initial blog categories
INSERT INTO blog_categories (name, slug, sort_order) VALUES
  ('Tips & Tricks', 'tips-tricks', 1),
  ('Ghid Business', 'ghid-business', 2),
  ('Tendințe', 'tendinte', 3),
  ('Oferte Sezoniere', 'oferte-sezoniere', 4),
  ('Noutăți OFAI', 'noutati-ofai', 5);
