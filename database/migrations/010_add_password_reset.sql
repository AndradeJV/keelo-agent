-- =============================================================================
-- Migration 010: Add password reset token columns to users table
-- =============================================================================

-- Add password reset columns
ALTER TABLE users ADD COLUMN IF NOT EXISTS password_reset_token VARCHAR(255);
ALTER TABLE users ADD COLUMN IF NOT EXISTS password_reset_expires TIMESTAMPTZ;

-- Add index for fast token lookup
CREATE INDEX IF NOT EXISTS idx_users_password_reset_token ON users(password_reset_token);

COMMENT ON COLUMN users.password_reset_token IS 'Token for password reset via email';
COMMENT ON COLUMN users.password_reset_expires IS 'Expiration time for the password reset token';

