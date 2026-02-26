-- Migration 004: Add trigger_source column to analyses table
-- Tracks how the analysis was triggered: 'auto', 'command', or 'silent'
-- 'silent' = hybrid mode (dashboard only, no PR comment)

ALTER TABLE analyses ADD COLUMN IF NOT EXISTS trigger_source VARCHAR(20) DEFAULT 'auto';

-- Update existing records based on heuristics
-- (Analyses without a PR number are likely 'requirements' type, keep as 'auto')
COMMENT ON COLUMN analyses.trigger_source IS 'How the analysis was triggered: auto (webhook+comment), command (/keelo), silent (hybrid/dashboard-only)';

