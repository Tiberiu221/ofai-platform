-- Migration 056: Add AI suggested review responses feature flag
-- Premium-only feature: generates response suggestions using Claude AI

ALTER TABLE subscription_plans
ADD COLUMN IF NOT EXISTS has_ai_suggested_responses BOOLEAN NOT NULL DEFAULT FALSE;

-- Only Premium gets AI suggested responses
UPDATE subscription_plans SET has_ai_suggested_responses = TRUE WHERE slug = 'premium';
