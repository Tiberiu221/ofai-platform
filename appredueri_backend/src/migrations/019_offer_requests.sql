-- Migration 019: Offer Requests ("Pinch") system
-- Users can request offers from businesses that don't have active ones.
-- No UNIQUE constraint — allows multiple requests (rate-limited by app logic, 1/week).
-- This lets us track repeat demand over time.

CREATE TABLE IF NOT EXISTS offer_requests (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  business_id INTEGER NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_offer_requests_business ON offer_requests(business_id);
CREATE INDEX IF NOT EXISTS idx_offer_requests_user_biz ON offer_requests(user_id, business_id);
