-- Migration: Create user_businesses table if not exists with correct schema
-- Description: This table connects users to businesses they are allowed to manage.

CREATE TABLE IF NOT EXISTS user_businesses (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    business_id INTEGER NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, business_id)
);

-- Index for faster lookups
CREATE INDEX IF NOT EXISTS idx_user_businesses_user_id ON user_businesses(user_id);
CREATE INDEX IF NOT EXISTS idx_user_businesses_business_id ON user_businesses(business_id);
