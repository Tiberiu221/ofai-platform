-- Migration 034: Business custom push notifications log
-- Tracks push notifications sent by business owners (for rate limiting + history)

CREATE TABLE IF NOT EXISTS business_push_log (
  id SERIAL PRIMARY KEY,
  business_id INTEGER NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  sent_by INTEGER NOT NULL REFERENCES users(id) ON DELETE SET NULL,
  title VARCHAR(100) NOT NULL,
  message VARCHAR(300) NOT NULL,
  recipients_count INTEGER NOT NULL DEFAULT 0,
  success_count INTEGER NOT NULL DEFAULT 0,
  failure_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_business_push_log_bid
  ON business_push_log(business_id, created_at DESC);

-- Index for rate limit check (business + recent window)
CREATE INDEX IF NOT EXISTS idx_business_push_log_rate
  ON business_push_log(business_id, created_at)
  WHERE created_at >= NOW() - INTERVAL '7 days';
