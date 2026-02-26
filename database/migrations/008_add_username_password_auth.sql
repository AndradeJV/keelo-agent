-- =============================================================================
-- Migration 008: Add username/password authentication support
-- =============================================================================

-- Add username and password_hash columns to users
ALTER TABLE users ALTER COLUMN google_id DROP NOT NULL;
ALTER TABLE users ADD COLUMN IF NOT EXISTS username VARCHAR(255) UNIQUE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS password_hash VARCHAR(255);

CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);

-- Make google_id nullable (users can now login with username/password only)
-- The UNIQUE constraint on google_id still applies for non-null values

COMMENT ON COLUMN users.username IS 'Username for email/password login (optional, null for Google-only users)';
COMMENT ON COLUMN users.password_hash IS 'Bcrypt password hash (null for Google-only users)';

