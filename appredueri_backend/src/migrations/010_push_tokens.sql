-- Migration: Push Notification Tokens
-- Date: 2026-01-31

-- Tabel pentru stocarea push tokens (Expo Push)
CREATE TABLE IF NOT EXISTS push_tokens (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    token VARCHAR(255) NOT NULL UNIQUE,
    platform VARCHAR(20) NOT NULL CHECK (platform IN ('ios', 'android', 'web')),
    device_name VARCHAR(255),
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Index pentru căutare rapidă după user
CREATE INDEX IF NOT EXISTS idx_push_tokens_user_id ON push_tokens(user_id);

-- Index pentru tokens active
CREATE INDEX IF NOT EXISTS idx_push_tokens_active ON push_tokens(is_active) WHERE is_active = TRUE;

-- Tabel pentru istoricul notificărilor trimise (opțional, pentru analytics)
CREATE TABLE IF NOT EXISTS push_notifications_log (
    id SERIAL PRIMARY KEY,
    title VARCHAR(255) NOT NULL,
    body TEXT,
    data JSONB,
    sent_by INTEGER REFERENCES users(id),
    target_type VARCHAR(50) NOT NULL CHECK (target_type IN ('all', 'user', 'subscribers', 'city')),
    target_id INTEGER, -- user_id, business_id, sau city_id în funcție de target_type
    tokens_count INTEGER DEFAULT 0,
    success_count INTEGER DEFAULT 0,
    failure_count INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Index pentru analytics
CREATE INDEX IF NOT EXISTS idx_push_log_created ON push_notifications_log(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_push_log_sent_by ON push_notifications_log(sent_by);

COMMENT ON TABLE push_tokens IS 'Stochează Expo Push tokens pentru fiecare device al utilizatorilor';
COMMENT ON TABLE push_notifications_log IS 'Istoric notificări trimise pentru analytics și debugging';
