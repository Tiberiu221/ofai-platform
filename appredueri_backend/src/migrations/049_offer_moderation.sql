-- Migration 049: AI moderation columns on offers table
-- Enables AI validation pipeline for offer content quality

ALTER TABLE offers ADD COLUMN IF NOT EXISTS moderation_status VARCHAR(20) DEFAULT 'auto_approved'
  CHECK (moderation_status IN ('auto_approved', 'pending_review', 'approved', 'rejected'));
ALTER TABLE offers ADD COLUMN IF NOT EXISTS ai_score SMALLINT;
ALTER TABLE offers ADD COLUMN IF NOT EXISTS ai_flags JSONB;
ALTER TABLE offers ADD COLUMN IF NOT EXISTS ai_reasoning TEXT;

CREATE INDEX IF NOT EXISTS idx_offers_moderation ON offers(moderation_status)
  WHERE moderation_status = 'pending_review';
