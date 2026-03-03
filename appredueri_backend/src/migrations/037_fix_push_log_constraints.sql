-- Migration 037: Fix business_push_log constraints
-- R1: sent_by NOT NULL conflicts with ON DELETE SET NULL
-- R2: Partial index with NOW() is useless (volatile function)

-- R1 fix: Allow NULL on sent_by (user can be deleted, log remains)
ALTER TABLE business_push_log
  ALTER COLUMN sent_by DROP NOT NULL;

-- R2 fix: Drop useless partial index, replace with plain index
DROP INDEX IF EXISTS idx_business_push_log_rate;

CREATE INDEX IF NOT EXISTS idx_business_push_log_rate
  ON business_push_log(business_id, created_at DESC);
