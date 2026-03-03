-- Migration 035: Deal of the Day nominations queue
-- Premium businesses can nominate their offers for Deal of the Day

CREATE TABLE IF NOT EXISTS deal_nominations (
  id SERIAL PRIMARY KEY,
  business_id INTEGER NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  offer_id INTEGER NOT NULL REFERENCES offers(id) ON DELETE CASCADE,
  nominated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  selected_for_date DATE,
  status VARCHAR(20) NOT NULL DEFAULT 'pending',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Fast lookup: pending nominations ordered by age (for selection cron)
CREATE INDEX IF NOT EXISTS idx_deal_nominations_pending
  ON deal_nominations(nominated_at ASC)
  WHERE status = 'pending';

-- Fast lookup: selected nomination for a specific date
CREATE INDEX IF NOT EXISTS idx_deal_nominations_selected_date
  ON deal_nominations(selected_for_date)
  WHERE status = 'selected';

-- Fast lookup: recent nominations per business (for rate-limit check)
CREATE INDEX IF NOT EXISTS idx_deal_nominations_business_recent
  ON deal_nominations(business_id, nominated_at DESC);

-- Prevent double-nomination of the same offer while pending
CREATE UNIQUE INDEX IF NOT EXISTS idx_deal_nominations_unique_pending_offer
  ON deal_nominations(offer_id)
  WHERE status = 'pending';
