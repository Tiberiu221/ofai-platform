-- Migration 058: Category rankings for home feed
-- Pre-computed every 2 days by cron job
-- Date: 2026-03-16

CREATE TABLE IF NOT EXISTS category_rankings (
  category_id  INT PRIMARY KEY REFERENCES categories(id) ON DELETE CASCADE,
  rank         INT NOT NULL,
  score        NUMERIC(6,2) NOT NULL DEFAULT 0,
  offer_count  INT NOT NULL DEFAULT 0,
  updated_at   TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_category_rankings_rank ON category_rankings(rank);
