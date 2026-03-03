-- 033: Business Subscription System Foundation
-- Creates subscription_plans, business_subscriptions, subscription_history tables
-- Seeds 3 plans (Free, Standard, Premium) and assigns all existing businesses to Free

-- Tier plans (static reference data)
CREATE TABLE IF NOT EXISTS subscription_plans (
  id SERIAL PRIMARY KEY,
  slug VARCHAR(20) UNIQUE NOT NULL,       -- 'free', 'standard', 'premium'
  name VARCHAR(50) NOT NULL,              -- 'Gratuit', 'Standard', 'Premium'
  price_monthly INTEGER NOT NULL,         -- in bani (RON * 100): 0, 4900, 19900
  price_yearly INTEGER NOT NULL,          -- in bani: 0, 49000, 199000
  max_active_offers INTEGER,              -- NULL = unlimited
  max_gallery_images INTEGER,             -- NULL = unlimited
  max_locations INTEGER,                  -- NULL = unlimited
  max_promo_codes_per_offer INTEGER,      -- NULL = unlimited
  analytics_days INTEGER NOT NULL DEFAULT 7,  -- 7, 30, 90
  can_respond_reviews BOOLEAN NOT NULL DEFAULT FALSE,
  can_upload_logo BOOLEAN NOT NULL DEFAULT FALSE,
  can_upload_cover BOOLEAN NOT NULL DEFAULT FALSE,
  has_verified_badge BOOLEAN NOT NULL DEFAULT FALSE,
  has_ai_summary BOOLEAN NOT NULL DEFAULT FALSE,
  has_push_on_offer BOOLEAN NOT NULL DEFAULT FALSE,
  has_custom_push BOOLEAN NOT NULL DEFAULT FALSE,
  has_analytics_charts BOOLEAN NOT NULL DEFAULT FALSE,
  has_analytics_export BOOLEAN NOT NULL DEFAULT FALSE,
  has_competitive_insights BOOLEAN NOT NULL DEFAULT FALSE,
  has_promoted_placement BOOLEAN NOT NULL DEFAULT FALSE,
  has_search_priority BOOLEAN NOT NULL DEFAULT FALSE,
  has_competitor_blocking BOOLEAN NOT NULL DEFAULT FALSE,
  has_deal_nomination BOOLEAN NOT NULL DEFAULT FALSE,
  has_booking BOOLEAN NOT NULL DEFAULT FALSE,
  has_priority_support BOOLEAN NOT NULL DEFAULT FALSE,
  badge_type VARCHAR(20) DEFAULT NULL,    -- NULL, 'verified', 'premium'
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Business subscriptions (one active per business)
CREATE TABLE IF NOT EXISTS business_subscriptions (
  id SERIAL PRIMARY KEY,
  business_id INTEGER NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  plan_id INTEGER NOT NULL REFERENCES subscription_plans(id),
  status VARCHAR(20) NOT NULL DEFAULT 'active',
    -- 'active', 'trial', 'past_due', 'cancelled', 'expired'
  billing_cycle VARCHAR(10) NOT NULL DEFAULT 'monthly',
    -- 'monthly', 'yearly', 'none' (free)
  current_period_start TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  current_period_end TIMESTAMPTZ,          -- NULL for free tier
  trial_start TIMESTAMPTZ,
  trial_end TIMESTAMPTZ,
  cancel_at_period_end BOOLEAN NOT NULL DEFAULT FALSE,
  stripe_subscription_id VARCHAR(255),     -- populated later by Stripe integration
  stripe_customer_id VARCHAR(255),         -- populated later
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Unique: one active subscription per business
CREATE UNIQUE INDEX IF NOT EXISTS idx_business_subscriptions_active
  ON business_subscriptions(business_id)
  WHERE status IN ('active', 'trial');

-- Index for expiry checks (cron job)
CREATE INDEX IF NOT EXISTS idx_business_subscriptions_expiry
  ON business_subscriptions(current_period_end)
  WHERE status IN ('active', 'trial');

-- Subscription change history (audit trail)
CREATE TABLE IF NOT EXISTS subscription_history (
  id SERIAL PRIMARY KEY,
  business_id INTEGER NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  from_plan_id INTEGER REFERENCES subscription_plans(id),
  to_plan_id INTEGER NOT NULL REFERENCES subscription_plans(id),
  action VARCHAR(20) NOT NULL,
    -- 'created', 'upgraded', 'downgraded', 'cancelled', 'renewed', 'trial_started', 'trial_expired'
  reason TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_subscription_history_business
  ON subscription_history(business_id, created_at DESC);

-- Seed the 3 plans
INSERT INTO subscription_plans
  (slug, name, price_monthly, price_yearly, sort_order,
   max_active_offers, max_gallery_images, max_locations, max_promo_codes_per_offer,
   analytics_days, can_respond_reviews, can_upload_logo, can_upload_cover,
   has_verified_badge, has_ai_summary, has_push_on_offer, has_custom_push,
   has_analytics_charts, has_analytics_export, has_competitive_insights,
   has_promoted_placement, has_search_priority, has_competitor_blocking,
   has_deal_nomination, has_booking, has_priority_support, badge_type)
VALUES
  -- FREE
  ('free', 'Gratuit', 0, 0, 0,
   2, 3, 1, 0,
   7, FALSE, FALSE, FALSE,
   FALSE, FALSE, FALSE, FALSE,
   FALSE, FALSE, FALSE,
   FALSE, FALSE, FALSE,
   FALSE, FALSE, FALSE, NULL),

  -- STANDARD
  ('standard', 'Standard', 4900, 49000, 1,
   10, 8, 3, 3,
   30, TRUE, TRUE, TRUE,
   TRUE, TRUE, TRUE, FALSE,
   TRUE, FALSE, FALSE,
   FALSE, FALSE, FALSE,
   FALSE, TRUE, FALSE, 'verified'),

  -- PREMIUM
  ('premium', 'Premium', 19900, 199000, 2,
   NULL, NULL, NULL, NULL,
   90, TRUE, TRUE, TRUE,
   TRUE, TRUE, TRUE, TRUE,
   TRUE, TRUE, TRUE,
   TRUE, TRUE, TRUE,
   TRUE, TRUE, TRUE, 'premium')
ON CONFLICT (slug) DO NOTHING;

-- Assign all existing businesses to free tier
INSERT INTO business_subscriptions (business_id, plan_id, status, billing_cycle)
SELECT b.id, sp.id, 'active', 'none'
FROM businesses b
CROSS JOIN subscription_plans sp
WHERE sp.slug = 'free'
  AND NOT EXISTS (
    SELECT 1 FROM business_subscriptions bs WHERE bs.business_id = b.id
  );
