-- Migration 047: Add missing indexes identified in Audit #9
-- H3: business_clicks.offer_id — used in Deal-of-Day fallback ORDER BY subquery
-- H4: offer_views(business_id, viewed_at) — used in analytics date-range queries

CREATE INDEX IF NOT EXISTS idx_bclicks_offer_id
  ON business_clicks(offer_id)
  WHERE offer_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_offer_views_bid_date
  ON offer_views(business_id, viewed_at);

-- L5: Drop redundant 2-column index superseded by 3-column composite from migration 028
DROP INDEX IF EXISTS idx_bclicks_action;
