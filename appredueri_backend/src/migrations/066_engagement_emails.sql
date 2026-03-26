-- Migration 066: Email engagement infrastructure
-- Adds email_logs table for admin visibility + idempotency columns

-- Email logs table — tracks ALL sent emails
CREATE TABLE IF NOT EXISTS email_logs (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  email_to VARCHAR(255) NOT NULL,
  email_type VARCHAR(50) NOT NULL,
  subject VARCHAR(500),
  status VARCHAR(20) DEFAULT 'sent',
  resend_id VARCHAR(100),
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_email_logs_user ON email_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_email_logs_type ON email_logs(email_type);
CREATE INDEX IF NOT EXISTS idx_email_logs_created ON email_logs(created_at);

-- Idempotency: trial warning tracking
ALTER TABLE business_subscriptions
  ADD COLUMN IF NOT EXISTS trial_warning_sent_at TIMESTAMPTZ DEFAULT NULL;

-- Idempotency: re-engagement tracking
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS reengagement_sent_at TIMESTAMPTZ DEFAULT NULL;
