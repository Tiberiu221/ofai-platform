-- Migration 018: Add FCM support to push_tokens
-- Allows storing both Expo and FCM token types

ALTER TABLE push_tokens ADD COLUMN IF NOT EXISTS token_type VARCHAR(10) DEFAULT 'expo';
ALTER TABLE push_tokens ADD CONSTRAINT push_tokens_token_type_check CHECK (token_type IN ('expo', 'fcm'));
CREATE INDEX IF NOT EXISTS idx_push_tokens_type ON push_tokens(token_type);
