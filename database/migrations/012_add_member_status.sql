-- =============================================================================
-- Migration 012: Add status and last_active_at to org_members
-- =============================================================================

-- Status: 'active' (using the platform), 'invited' (pending acceptance), 'inactive' (no recent activity)
ALTER TABLE org_members ADD COLUMN IF NOT EXISTS status VARCHAR(20) NOT NULL DEFAULT 'active';
ALTER TABLE org_members ADD COLUMN IF NOT EXISTS last_active_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();
ALTER TABLE org_members ADD COLUMN IF NOT EXISTS invited_at TIMESTAMP WITH TIME ZONE;

-- Set existing members to active
UPDATE org_members SET status = 'active' WHERE status IS NULL OR status = '';

CREATE INDEX IF NOT EXISTS idx_org_members_status ON org_members(status);

COMMENT ON COLUMN org_members.status IS 'Member status: active, invited, inactive';
COMMENT ON COLUMN org_members.last_active_at IS 'Last time the member performed an action in this org';
COMMENT ON COLUMN org_members.invited_at IS 'When the member was invited (null if original owner)';

