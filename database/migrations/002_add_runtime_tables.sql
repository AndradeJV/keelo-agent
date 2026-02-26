-- Migration: Add Runtime Exploration Tables
-- Created: 2024
-- Description: Tables for storing autonomous exploration results

-- Runtime Explorations Table
CREATE TABLE IF NOT EXISTS runtime_explorations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    environment VARCHAR(20) NOT NULL CHECK (environment IN ('staging', 'production')),
    start_time TIMESTAMP WITH TIME ZONE NOT NULL,
    end_time TIMESTAMP WITH TIME ZONE NOT NULL,
    pages_visited INTEGER NOT NULL DEFAULT 0,
    bugs_critical INTEGER NOT NULL DEFAULT 0,
    bugs_high INTEGER NOT NULL DEFAULT 0,
    bugs_medium INTEGER NOT NULL DEFAULT 0,
    bugs_low INTEGER NOT NULL DEFAULT 0,
    flows_passed INTEGER NOT NULL DEFAULT 0,
    flows_failed INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Runtime Bugs Table
CREATE TABLE IF NOT EXISTS runtime_bugs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    exploration_id UUID REFERENCES runtime_explorations(id) ON DELETE CASCADE,
    type VARCHAR(50) NOT NULL,
    severity VARCHAR(20) NOT NULL CHECK (severity IN ('critical', 'high', 'medium', 'low')),
    message TEXT NOT NULL,
    url TEXT,
    selector TEXT,
    screenshot TEXT,
    stack_trace TEXT,
    timestamp TIMESTAMP WITH TIME ZONE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_runtime_explorations_environment ON runtime_explorations(environment);
CREATE INDEX IF NOT EXISTS idx_runtime_explorations_start_time ON runtime_explorations(start_time DESC);
CREATE INDEX IF NOT EXISTS idx_runtime_bugs_exploration_id ON runtime_bugs(exploration_id);
CREATE INDEX IF NOT EXISTS idx_runtime_bugs_severity ON runtime_bugs(severity);
CREATE INDEX IF NOT EXISTS idx_runtime_bugs_type ON runtime_bugs(type);

-- Auto-fix attempts tracking
CREATE TABLE IF NOT EXISTS auto_fix_attempts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    test_pr_number INTEGER NOT NULL,
    repository VARCHAR(255) NOT NULL,
    attempt_number INTEGER NOT NULL,
    success BOOLEAN NOT NULL DEFAULT FALSE,
    error_message TEXT,
    fix_applied TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_auto_fix_attempts_pr ON auto_fix_attempts(test_pr_number);
CREATE INDEX IF NOT EXISTS idx_auto_fix_attempts_repo ON auto_fix_attempts(repository);

