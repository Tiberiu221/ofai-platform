-- Migration 080: Pre-computed performance scores for offers and businesses
-- Computed by cron job every 2 hours. Replaces inline scoring in queries.
-- Score range: 0.0000 to 1.0000
-- score_components JSONB stores breakdown for portal transparency

-- ═══ OFFER SCORES ═══
ALTER TABLE offers ADD COLUMN IF NOT EXISTS performance_score NUMERIC(6,4) DEFAULT 0;
ALTER TABLE offers ADD COLUMN IF NOT EXISTS score_components JSONB DEFAULT '{}';
ALTER TABLE offers ADD COLUMN IF NOT EXISTS score_updated_at TIMESTAMPTZ;

-- Partial index for hot path: active+approved offers sorted by score
CREATE INDEX IF NOT EXISTS idx_offers_active_score
  ON offers(performance_score DESC, id DESC)
  WHERE is_active = TRUE AND moderation_status IN ('approved', 'auto_approved');

-- ═══ BUSINESS SCORES ═══
ALTER TABLE businesses ADD COLUMN IF NOT EXISTS performance_score NUMERIC(6,4) DEFAULT 0;
ALTER TABLE businesses ADD COLUMN IF NOT EXISTS completeness_score NUMERIC(4,2) DEFAULT 0;
ALTER TABLE businesses ADD COLUMN IF NOT EXISTS score_components JSONB DEFAULT '{}';
ALTER TABLE businesses ADD COLUMN IF NOT EXISTS score_updated_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_businesses_performance_score
  ON businesses(performance_score DESC);
