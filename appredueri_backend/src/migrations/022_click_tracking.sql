-- Migration 022: Click tracking for business analytics
-- Tracks all user interactions (phone calls, WhatsApp, booking, share, etc.)
-- Anonymous (no user_id) for GDPR compliance

CREATE TABLE IF NOT EXISTS business_clicks (
  id BIGSERIAL PRIMARY KEY,
  business_id INTEGER NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  offer_id INTEGER REFERENCES offers(id) ON DELETE CASCADE,
  action_type VARCHAR(30) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_bclicks_biz_date ON business_clicks(business_id, created_at);
CREATE INDEX IF NOT EXISTS idx_bclicks_action ON business_clicks(business_id, action_type);

-- action_type values:
-- phone, whatsapp, booking_url, website, navigate, share,
-- follow, unfollow, favorite, unfavorite, gallery, copy_code
