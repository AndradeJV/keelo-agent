-- =============================================================================
-- Migration 009: Add email verification and GitHub OAuth support
-- =============================================================================

-- Email verification columns
ALTER TABLE users ADD COLUMN IF NOT EXISTS email_verified BOOLEAN DEFAULT FALSE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS verification_token VARCHAR(255);
ALTER TABLE users ADD COLUMN IF NOT EXISTS verification_token_expires TIMESTAMPTZ;

-- GitHub OAuth column
ALTER TABLE users ADD COLUMN IF NOT EXISTS github_id VARCHAR(255);

-- Users from social login (Google/GitHub) are already verified
UPDATE users SET email_verified = TRUE WHERE google_id IS NOT NULL;

-- Admin users are also verified
UPDATE users SET email_verified = TRUE WHERE role = 'admin';

-- Indexes
CREATE INDEX IF NOT EXISTS idx_users_github_id ON users(github_id);
CREATE INDEX IF NOT EXISTS idx_users_verification_token ON users(verification_token);
CREATE INDEX IF NOT EXISTS idx_users_email_verified ON users(email_verified);

-- Create unique index for github_id (allowing NULLs)
CREATE UNIQUE INDEX IF NOT EXISTS idx_users_github_id_unique ON users(github_id) WHERE github_id IS NOT NULL;

COMMENT ON COLUMN users.email_verified IS 'Whether the user has verified their email address';
COMMENT ON COLUMN users.verification_token IS 'Token sent via email for email verification';
COMMENT ON COLUMN users.verification_token_expires IS 'Expiration time for the verification token';
COMMENT ON COLUMN users.github_id IS 'GitHub user ID for OAuth login';

