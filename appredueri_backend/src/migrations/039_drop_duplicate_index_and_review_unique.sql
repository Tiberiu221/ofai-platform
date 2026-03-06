-- 039: Drop duplicate index + add UNIQUE on review_responses(review_id)
-- idx_business_push_log_bid (business_id) is redundant — covered by idx_business_push_log_rate composite from 037
DROP INDEX IF EXISTS idx_business_push_log_bid;

-- Ensure one response per review (prevents TOCTOU race in review response endpoint)
CREATE UNIQUE INDEX IF NOT EXISTS review_responses_review_id_unique
  ON review_responses (review_id);
