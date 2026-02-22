-- 030_platform_polish.sql
-- Platform Polish: deal of day, limited codes, gamification

-- Offers: deal of day + limited codes
ALTER TABLE offers ADD COLUMN IF NOT EXISTS is_deal_of_day BOOLEAN DEFAULT FALSE;
ALTER TABLE offers ADD COLUMN IF NOT EXISTS deal_of_day_date DATE;
ALTER TABLE offers ADD COLUMN IF NOT EXISTS max_reveals INTEGER;

-- Users: gamification
ALTER TABLE users ADD COLUMN IF NOT EXISTS points INTEGER DEFAULT 0;
ALTER TABLE users ADD COLUMN IF NOT EXISTS current_streak INTEGER DEFAULT 0;
ALTER TABLE users ADD COLUMN IF NOT EXISTS last_visit_date DATE;

-- Point transactions
CREATE TABLE IF NOT EXISTS point_transactions (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  action VARCHAR(50) NOT NULL,
  points INTEGER NOT NULL,
  reference_id INTEGER,
  reference_type VARCHAR(30),
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_point_transactions_user ON point_transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_point_transactions_action ON point_transactions(user_id, action);

-- User badges
CREATE TABLE IF NOT EXISTS user_badges (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  badge_type VARCHAR(50) NOT NULL,
  unlocked_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, badge_type)
);
CREATE INDEX IF NOT EXISTS idx_user_badges_user ON user_badges(user_id);

-- Index for trending calculation (recent favorites)
CREATE INDEX IF NOT EXISTS idx_favorite_offers_created ON favorite_offers(created_at);

-- Index for deal of day queries
CREATE INDEX IF NOT EXISTS idx_offers_deal_of_day ON offers(is_deal_of_day) WHERE is_deal_of_day = TRUE;
