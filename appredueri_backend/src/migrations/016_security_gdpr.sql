-- Migration 016: Security & GDPR Improvements
-- Refresh tokens, GDPR consent, audit log, push log retention

-- ============================================
-- REFRESH TOKENS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS refresh_tokens (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token VARCHAR(255) NOT NULL UNIQUE,
    expires_at TIMESTAMP NOT NULL,
    created_at TIMESTAMP DEFAULT NOW(),
    revoked_at TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_refresh_tokens_user_id ON refresh_tokens(user_id);
CREATE INDEX IF NOT EXISTS idx_refresh_tokens_token ON refresh_tokens(token);

-- Cleanup: delete expired/revoked tokens older than 60 days
-- Run periodically: DELETE FROM refresh_tokens WHERE (expires_at < NOW() - INTERVAL '60 days') OR (revoked_at IS NOT NULL AND revoked_at < NOW() - INTERVAL '60 days');

-- ============================================
-- GDPR CONSENT COLUMNS
-- ============================================
ALTER TABLE users ADD COLUMN IF NOT EXISTS privacy_accepted_at TIMESTAMP;
ALTER TABLE users ADD COLUMN IF NOT EXISTS terms_accepted_at TIMESTAMP;

COMMENT ON COLUMN users.privacy_accepted_at IS 'Timestamp when user accepted Privacy Policy (GDPR Art. 7)';
COMMENT ON COLUMN users.terms_accepted_at IS 'Timestamp when user accepted Terms of Service';

-- ============================================
-- AUDIT LOG TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS audit_log (
    id SERIAL PRIMARY KEY,
    action VARCHAR(50) NOT NULL,
    entity_type VARCHAR(50),
    entity_id INTEGER,
    user_id INTEGER,
    ip_address INET,
    details JSONB,
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_audit_log_user ON audit_log(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_action ON audit_log(action);
CREATE INDEX IF NOT EXISTS idx_audit_log_created ON audit_log(created_at);

COMMENT ON TABLE audit_log IS 'Logs critical security actions: account_delete, role_change, ban, unban, admin_login, data_export';

-- ============================================
-- PUSH NOTIFICATIONS LOG — RETENTION INDEX
-- ============================================
-- Add index for efficient cleanup of old logs
CREATE INDEX IF NOT EXISTS idx_push_notifications_log_created
ON push_notifications_log(created_at);

-- Cleanup query (run periodically):
-- DELETE FROM push_notifications_log WHERE created_at < NOW() - INTERVAL '90 days';
