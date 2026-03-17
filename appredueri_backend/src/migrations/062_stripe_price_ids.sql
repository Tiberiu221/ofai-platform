-- Migration 062: Add Stripe Price IDs to subscription_plans
-- Stores fixed Stripe Price IDs for subscription management (downgrade, plan switch)
-- Date: 2026-03-17

ALTER TABLE subscription_plans ADD COLUMN IF NOT EXISTS stripe_price_monthly_id VARCHAR(255);
ALTER TABLE subscription_plans ADD COLUMN IF NOT EXISTS stripe_price_yearly_id VARCHAR(255);

-- Populate with existing Stripe Price IDs (test mode)
UPDATE subscription_plans SET stripe_price_monthly_id = 'price_1TC1INIcNtMOO3toQip707BA' WHERE slug = 'standard';
UPDATE subscription_plans SET stripe_price_monthly_id = 'price_1TC1IaIcNtMOO3toheWB2fnX' WHERE slug = 'premium';
