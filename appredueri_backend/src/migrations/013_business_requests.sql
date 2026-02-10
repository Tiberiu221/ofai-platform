-- Migration 013: Create business_requests table for user-submitted businesses
-- Flow: user submits → AI validates → admin approves/rejects

CREATE TABLE IF NOT EXISTS business_requests (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id),

  -- Business data
  name VARCHAR(200) NOT NULL,
  category_id INTEGER REFERENCES categories(id),
  city_id INTEGER REFERENCES cities(id),
  address TEXT,
  phone VARCHAR(50),
  website VARCHAR(500),
  description TEXT,

  -- AI Validation results
  ai_score SMALLINT,
  ai_flags JSONB DEFAULT '[]',
  ai_reasoning TEXT,

  -- Status flow
  status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  admin_notes TEXT,
  reviewed_by INTEGER REFERENCES users(id),
  reviewed_at TIMESTAMPTZ,

  -- Created business (after approval)
  business_id INTEGER REFERENCES businesses(id),

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_business_requests_status ON business_requests(status);
CREATE INDEX IF NOT EXISTS idx_business_requests_user ON business_requests(user_id);
