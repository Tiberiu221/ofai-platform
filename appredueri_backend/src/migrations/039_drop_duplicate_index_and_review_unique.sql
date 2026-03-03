-- 039: Drop duplicate index + add UNIQUE on review_responses(review_id)
-- idx_business_push_log_bid is identical to idx_business_push_log_rate (both on business_id)
DROP INDEX IF EXISTS idx_business_push_log_bid;

-- Ensure one response per review (prevents TOCTOU race in review response endpoint)
CREATE UNIQUE INDEX IF NOT EXISTS review_responses_review_id_unique
  ON review_responses (review_id);
