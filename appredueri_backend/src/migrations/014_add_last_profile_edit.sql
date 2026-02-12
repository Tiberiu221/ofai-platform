-- Add last_profile_edit timestamp to users table
ALTER TABLE users ADD COLUMN IF NOT EXISTS last_profile_edit TIMESTAMP;
