-- Migration 057: Audit #10 schema fixes
-- Date: 2026-03-12

-- DB-C01: Fix review_summaries columns to match summarizationService.js
-- Code expects: summary_text, model_used, tokens_used, last_review_id
-- Migration 046 created: summary, avg_rating (without model_used, tokens_used, last_review_id)
DO $$
BEGIN
  -- Rename 'summary' to 'summary_text' if old column exists
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'review_summaries' AND column_name = 'summary'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'review_summaries' AND column_name = 'summary_text'
  ) THEN
    ALTER TABLE review_summaries RENAME COLUMN summary TO summary_text;
  END IF;
END $$;

ALTER TABLE review_summaries ADD COLUMN IF NOT EXISTS summary_text TEXT;
ALTER TABLE review_summaries ADD COLUMN IF NOT EXISTS model_used VARCHAR(50);
ALTER TABLE review_summaries ADD COLUMN IF NOT EXISTS tokens_used INTEGER;
ALTER TABLE review_summaries ADD COLUMN IF NOT EXISTS last_review_id INTEGER;

-- DB-C03: Add preferred_category_ids to users (heavily used in feeds/preferences)
ALTER TABLE users ADD COLUMN IF NOT EXISTS preferred_category_ids INTEGER[] DEFAULT '{}';

-- DB-C04: Normalize user_badges columns
-- Migration 043 uses 'earned_at', migration 046 uses 'awarded_at'
-- Code (badgeService.js) references 'earned_at'
ALTER TABLE user_badges ADD COLUMN IF NOT EXISTS earned_at TIMESTAMPTZ DEFAULT NOW();

-- Ensure business_subscriptions has UNIQUE on business_id (needed for ON CONFLICT)
-- Check if constraint already exists before adding
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'business_subscriptions_business_id_key'
      AND conrelid = 'business_subscriptions'::regclass
  ) THEN
    -- Only add if no other unique constraint on business_id exists
    IF NOT EXISTS (
      SELECT 1 FROM pg_constraint c
      JOIN pg_attribute a ON a.attnum = ANY(c.conkey) AND a.attrelid = c.conrelid
      WHERE c.conrelid = 'business_subscriptions'::regclass
        AND c.contype = 'u'
        AND a.attname = 'business_id'
    ) THEN
      ALTER TABLE business_subscriptions ADD CONSTRAINT business_subscriptions_business_id_key UNIQUE (business_id);
    END IF;
  END IF;
END $$;
