-- Migration 015: Add banned_at column to users table
-- Allows admins to ban/unban users

ALTER TABLE users ADD COLUMN IF NOT EXISTS banned_at TIMESTAMP;

COMMENT ON COLUMN users.banned_at IS 'Timestamp when user was banned (NULL if not banned)';
