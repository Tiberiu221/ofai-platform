-- Migration 043: Create badge_definitions + user_badges tables for gamification
-- Date: 5 Mar 2026
-- Required by: badgeService.js (checkAndAwardBadges, getUserBadges)
-- Safe to run: uses IF NOT EXISTS

-- 1. Badge catalogue
CREATE TABLE IF NOT EXISTS badge_definitions (
  id SERIAL PRIMARY KEY,
  slug VARCHAR(50) UNIQUE NOT NULL,
  name VARCHAR(100) NOT NULL,
  description TEXT,
  icon VARCHAR(50),
  color VARCHAR(20),
  category VARCHAR(30) DEFAULT 'general',
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Earned badges per user
CREATE TABLE IF NOT EXISTS user_badges (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  badge_id INTEGER NOT NULL REFERENCES badge_definitions(id) ON DELETE CASCADE,
  earned_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, badge_id)
);
CREATE INDEX IF NOT EXISTS idx_user_badges_user_id ON user_badges(user_id);

-- 3. Seed badge definitions (matching BADGE_CONDITIONS in badgeService.js)
INSERT INTO badge_definitions (slug, name, description, icon, color, category, sort_order)
VALUES
  ('early_adopter',    'Early Adopter',     'Printre primii 100 de utilizatori',           'star',          '#FFD700', 'special',  1),
  ('first_review',     'Prima Recenzie',    'Ai lăsat prima ta recenzie',                  'rate_review',   '#4CAF50', 'review',   10),
  ('reviewer_bronze',  'Recenzor Bronz',    'Ai lăsat 5 recenzii',                         'rate_review',   '#CD7F32', 'review',   11),
  ('reviewer_silver',  'Recenzor Argint',   'Ai lăsat 10 recenzii',                        'rate_review',   '#C0C0C0', 'review',   12),
  ('reviewer_gold',    'Recenzor Aur',      'Ai lăsat 25 de recenzii',                     'rate_review',   '#FFD700', 'review',   13),
  ('first_favorite',   'Prima Salvare',     'Ai salvat prima ta ofertă',                   'favorite',      '#E91E63', 'engage',   20),
  ('social_butterfly', 'Fluture Social',    'Urmărești 5 business-uri',                    'groups',        '#9C27B0', 'social',   30),
  ('loyal_fan',        'Fan Loial',         'Urmărești 15 business-uri',                   'loyalty',       '#FF5722', 'social',   31),
  ('code_hunter',      'Vânător de Coduri', 'Ai dezvăluit 10 coduri promoționale',         'qr_code',       '#00BCD4', 'engage',   40),
  ('explorer',         'Explorator',        'Ai vizitat 10 business-uri distincte',        'explore',       '#3F51B5', 'explore',  50)
ON CONFLICT (slug) DO NOTHING;
