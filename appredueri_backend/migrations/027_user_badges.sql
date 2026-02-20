-- Migration 027: User badges gamification system
-- Date: 20 Feb 2026

-- Badge definitions (admin-seeded, not user-editable)
CREATE TABLE IF NOT EXISTS badge_definitions (
  id SERIAL PRIMARY KEY,
  slug VARCHAR(50) UNIQUE NOT NULL,
  name VARCHAR(100) NOT NULL,
  description TEXT,
  icon VARCHAR(50) DEFAULT 'star',
  color VARCHAR(7) DEFAULT '#fb923c',
  category VARCHAR(30) DEFAULT 'general',
  sort_order INT DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- User earned badges (junction table)
CREATE TABLE IF NOT EXISTS user_badges (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  badge_id INTEGER NOT NULL REFERENCES badge_definitions(id) ON DELETE CASCADE,
  earned_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, badge_id)
);

CREATE INDEX IF NOT EXISTS idx_user_badges_user_id ON user_badges(user_id);
CREATE INDEX IF NOT EXISTS idx_user_badges_badge_id ON user_badges(badge_id);

-- Seed 10 badge definitions
INSERT INTO badge_definitions (slug, name, description, icon, color, category, sort_order) VALUES
  ('early_adopter',    'Early Adopter',     'Unul dintre primii 100 de utilizatori',    'rocket_launch', '#fb923c', 'general',  1),
  ('first_review',     'Prima Recenzie',    'Ai scris prima ta recenzie',               'edit',          '#22c55e', 'review',   2),
  ('reviewer_bronze',  'Critic Bronze',     'Ai scris 5 recenzii',                      'rate_review',   '#cd7f32', 'review',   3),
  ('reviewer_silver',  'Critic Silver',     'Ai scris 10 recenzii',                     'rate_review',   '#c0c0c0', 'review',   4),
  ('reviewer_gold',    'Critic Gold',       'Ai scris 25 recenzii',                     'rate_review',   '#ffd700', 'review',   5),
  ('first_favorite',   'Prima Favorizare',  'Ai adaugat prima oferta la favorite',      'bookmark_add',  '#a855f7', 'general',  6),
  ('social_butterfly', 'Social Butterfly',  'Urmaresti 5 business-uri',                 'favorite',      '#ec4899', 'social',   7),
  ('loyal_fan',        'Fan Fidel',         'Urmaresti 15 business-uri',                'loyalty',       '#ef4444', 'social',   8),
  ('code_hunter',      'Code Hunter',       'Ai dezvaluit 10 coduri promo',             'qr_code',       '#f97316', 'general',  9),
  ('explorer',         'Explorer',          'Ai interactionat cu 10 business-uri',      'explore',       '#3b82f6', 'explorer', 10)
ON CONFLICT (slug) DO NOTHING;
