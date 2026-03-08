-- 054: Concierge onboarding requests + has_concierge tier flag
-- Businesses can request manual setup help (Standard+ only)

ALTER TABLE subscription_plans
  ADD COLUMN IF NOT EXISTS has_concierge BOOLEAN NOT NULL DEFAULT FALSE;

UPDATE subscription_plans SET has_concierge = TRUE WHERE slug IN ('standard', 'premium');

CREATE TABLE IF NOT EXISTS onboarding_requests (
  id            SERIAL PRIMARY KEY,
  business_id   INTEGER NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  requested_by  INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  status        VARCHAR(20) NOT NULL DEFAULT 'pending'
                  CHECK (status IN ('pending', 'in_progress', 'completed', 'cancelled')),
  request_type  VARCHAR(30) NOT NULL DEFAULT 'full_setup'
                  CHECK (request_type IN ('catalog', 'hours', 'full_setup')),
  message       TEXT,
  attachments   JSONB NOT NULL DEFAULT '[]',
  admin_notes   TEXT,
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_at    TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_onboarding_requests_business
  ON onboarding_requests(business_id);

CREATE INDEX IF NOT EXISTS idx_onboarding_requests_status
  ON onboarding_requests(status, created_at DESC);

-- Only one pending/in_progress request per business at a time
CREATE UNIQUE INDEX IF NOT EXISTS idx_onboarding_active_per_business
  ON onboarding_requests(business_id)
  WHERE status IN ('pending', 'in_progress');
