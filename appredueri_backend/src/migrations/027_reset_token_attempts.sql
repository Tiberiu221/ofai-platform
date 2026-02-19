-- Migration 027: Add attempts column to password_reset_tokens for brute force protection
ALTER TABLE password_reset_tokens ADD COLUMN IF NOT EXISTS attempts INTEGER DEFAULT 0;
