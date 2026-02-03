-- Migration: Create review_summaries table
-- Description: Stores AI-generated summaries of business reviews
-- Date: 2026-02-03

CREATE TABLE IF NOT EXISTS review_summaries (
    id SERIAL PRIMARY KEY,
    business_id INTEGER NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
    summary_text TEXT NOT NULL,
    review_count INTEGER NOT NULL DEFAULT 0,
    last_review_id INTEGER REFERENCES reviews(id) ON DELETE SET NULL,
    generated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    model_used VARCHAR(50) DEFAULT 'claude-3-haiku-20240307',
    tokens_used INTEGER,
    UNIQUE(business_id)
);

-- Index for faster lookups
CREATE INDEX IF NOT EXISTS idx_review_summaries_business_id 
ON review_summaries(business_id);

-- Index for checking outdated summaries
CREATE INDEX IF NOT EXISTS idx_review_summaries_generated_at 
ON review_summaries(generated_at);

-- Comment on table
COMMENT ON TABLE review_summaries IS 'AI-generated summaries of business reviews using Claude LLM';
COMMENT ON COLUMN review_summaries.summary_text IS 'The generated summary text in Romanian';
COMMENT ON COLUMN review_summaries.review_count IS 'Number of reviews used to generate this summary';
COMMENT ON COLUMN review_summaries.last_review_id IS 'ID of the last review included in the summary';
COMMENT ON COLUMN review_summaries.tokens_used IS 'Total tokens consumed (for cost tracking)';
