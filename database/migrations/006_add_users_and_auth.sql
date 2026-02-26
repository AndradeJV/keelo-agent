-- =============================================================================
-- Migration 006: Add users table and multi-tenancy support
-- =============================================================================

-- Users table for Google Social Login
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    google_id VARCHAR(255) UNIQUE NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    name VARCHAR(255),
    avatar VARCHAR(1000),
    role VARCHAR(20) DEFAULT 'user',  -- 'user' | 'admin'
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    last_login_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_users_google_id ON users(google_id);
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);

-- Add user_id to repositories for ownership
ALTER TABLE repositories ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES users(id) ON DELETE CASCADE;
CREATE INDEX IF NOT EXISTS idx_repositories_user_id ON repositories(user_id);

-- Add user_id to analyses for ownership
ALTER TABLE analyses ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES users(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_analyses_user_id ON analyses(user_id);

COMMENT ON TABLE users IS 'Users authenticated via Google Social Login';
COMMENT ON COLUMN users.role IS 'User role: user (default) or admin';
COMMENT ON COLUMN repositories.user_id IS 'Owner of the repository/project';
COMMENT ON COLUMN analyses.user_id IS 'User who created the analysis';

