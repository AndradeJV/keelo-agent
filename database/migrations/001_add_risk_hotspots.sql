-- =============================================================================
-- Migration: Add risk_hotspots table
-- =============================================================================
-- Run this migration if the table doesn't exist in your database

-- =============================================================================
-- Table: risk_hotspots (Aggregated risk data by area/file)
-- =============================================================================

CREATE TABLE IF NOT EXISTS risk_hotspots (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    repository_id UUID REFERENCES repositories(id) ON DELETE CASCADE,
    
    -- Area identification
    file_path VARCHAR(1000),
    area_name VARCHAR(255),  -- e.g., 'auth', 'payments', 'api'
    
    -- Aggregated metrics
    total_risks INTEGER DEFAULT 0,
    critical_count INTEGER DEFAULT 0,
    high_count INTEGER DEFAULT 0,
    medium_count INTEGER DEFAULT 0,
    low_count INTEGER DEFAULT 0,
    
    -- Recent PRs that touched this area
    recent_prs INTEGER[] DEFAULT '{}',
    
    -- Last occurrence
    last_risk_at TIMESTAMP WITH TIME ZONE,
    last_risk_level risk_level,
    last_risk_title VARCHAR(500),
    
    -- Pattern detection
    recurring_issues TEXT[],
    common_categories TEXT[],
    
    -- Timestamps
    first_seen_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    UNIQUE(repository_id, file_path)
);

CREATE INDEX IF NOT EXISTS idx_hotspots_repository ON risk_hotspots(repository_id);
CREATE INDEX IF NOT EXISTS idx_hotspots_area ON risk_hotspots(area_name);
CREATE INDEX IF NOT EXISTS idx_hotspots_critical ON risk_hotspots(critical_count DESC);
CREATE INDEX IF NOT EXISTS idx_hotspots_total ON risk_hotspots(total_risks DESC);

-- =============================================================================
-- View: Hot spots summary
-- =============================================================================

CREATE OR REPLACE VIEW v_risk_hotspots AS
SELECT 
    h.id,
    r.full_name as repository,
    h.file_path,
    h.area_name,
    h.total_risks,
    h.critical_count,
    h.high_count,
    h.medium_count,
    h.low_count,
    h.last_risk_at,
    h.last_risk_level,
    h.last_risk_title,
    array_length(h.recent_prs, 1) as pr_count,
    h.recurring_issues,
    h.updated_at,
    -- Calculate risk score
    (h.critical_count * 10 + h.high_count * 5 + h.medium_count * 2 + h.low_count) as risk_score
FROM risk_hotspots h
JOIN repositories r ON h.repository_id = r.id
ORDER BY risk_score DESC;

-- =============================================================================
-- Function: Update risk hotspot
-- =============================================================================

CREATE OR REPLACE FUNCTION update_risk_hotspot(
    p_repository_id UUID,
    p_file_path VARCHAR,
    p_risk_level risk_level,
    p_risk_title VARCHAR,
    p_pr_number INTEGER
) RETURNS VOID AS $$
DECLARE
    v_area_name VARCHAR;
BEGIN
    -- Extract area name from file path
    v_area_name := CASE
        WHEN p_file_path ILIKE '%/auth/%' OR p_file_path ILIKE '%authentication%' THEN 'authentication'
        WHEN p_file_path ILIKE '%/payment%' OR p_file_path ILIKE '%/billing%' THEN 'payments'
        WHEN p_file_path ILIKE '%/api/%' OR p_file_path ILIKE '%/routes/%' THEN 'api'
        WHEN p_file_path ILIKE '%/database/%' OR p_file_path ILIKE '%/db/%' THEN 'database'
        WHEN p_file_path ILIKE '%/security/%' OR p_file_path ILIKE '%/crypto%' THEN 'security'
        WHEN p_file_path ILIKE '%/user%' THEN 'users'
        WHEN p_file_path ILIKE '%/core/%' THEN 'core'
        WHEN p_file_path ILIKE '%/service%' THEN 'services'
        WHEN p_file_path ILIKE '%/util%' OR p_file_path ILIKE '%/helper%' THEN 'utilities'
        WHEN p_file_path ILIKE '%/component%' THEN 'components'
        ELSE 'other'
    END;

    INSERT INTO risk_hotspots (
        repository_id, file_path, area_name,
        total_risks, critical_count, high_count, medium_count, low_count,
        recent_prs, last_risk_at, last_risk_level, last_risk_title
    ) VALUES (
        p_repository_id, p_file_path, v_area_name,
        1,
        CASE WHEN p_risk_level = 'critical' THEN 1 ELSE 0 END,
        CASE WHEN p_risk_level = 'high' THEN 1 ELSE 0 END,
        CASE WHEN p_risk_level = 'medium' THEN 1 ELSE 0 END,
        CASE WHEN p_risk_level = 'low' THEN 1 ELSE 0 END,
        ARRAY[p_pr_number],
        NOW(), p_risk_level, p_risk_title
    )
    ON CONFLICT (repository_id, file_path) DO UPDATE SET
        total_risks = risk_hotspots.total_risks + 1,
        critical_count = risk_hotspots.critical_count + CASE WHEN p_risk_level = 'critical' THEN 1 ELSE 0 END,
        high_count = risk_hotspots.high_count + CASE WHEN p_risk_level = 'high' THEN 1 ELSE 0 END,
        medium_count = risk_hotspots.medium_count + CASE WHEN p_risk_level = 'medium' THEN 1 ELSE 0 END,
        low_count = risk_hotspots.low_count + CASE WHEN p_risk_level = 'low' THEN 1 ELSE 0 END,
        recent_prs = ARRAY(SELECT DISTINCT unnest(risk_hotspots.recent_prs || ARRAY[p_pr_number]) ORDER BY 1 DESC LIMIT 10),
        last_risk_at = NOW(),
        last_risk_level = p_risk_level,
        last_risk_title = p_risk_title,
        updated_at = NOW();
END;
$$ LANGUAGE plpgsql;

COMMENT ON TABLE risk_hotspots IS 'Aggregated risk data by file/area for hot spot detection';

