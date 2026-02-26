-- =============================================================================
-- Keelo Database Schema
-- =============================================================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =============================================================================
-- Enum Types
-- =============================================================================

CREATE TYPE risk_level AS ENUM ('critical', 'high', 'medium', 'low');
CREATE TYPE analysis_type AS ENUM ('pr', 'requirements', 'figma', 'user_story');
CREATE TYPE analysis_status AS ENUM ('pending', 'processing', 'completed', 'failed');

-- =============================================================================
-- Table: repositories
-- =============================================================================

CREATE TABLE IF NOT EXISTS repositories (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    owner VARCHAR(255) NOT NULL,
    name VARCHAR(255) NOT NULL,
    full_name VARCHAR(512) GENERATED ALWAYS AS (owner || '/' || name) STORED,
    installation_id INTEGER,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    UNIQUE(owner, name)
);

CREATE INDEX idx_repositories_full_name ON repositories(full_name);

-- =============================================================================
-- Table: analyses (main table for all analysis types)
-- =============================================================================

CREATE TABLE IF NOT EXISTS analyses (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    
    -- Analysis metadata
    type analysis_type NOT NULL,
    status analysis_status DEFAULT 'pending',
    version VARCHAR(20) DEFAULT '1.0.0',
    
    -- Repository reference (optional for requirements analysis)
    repository_id UUID REFERENCES repositories(id) ON DELETE SET NULL,
    
    -- PR-specific fields
    pr_number INTEGER,
    pr_title VARCHAR(500),
    pr_url VARCHAR(1000),
    
    -- Requirements-specific fields
    feature_name VARCHAR(255),
    project_name VARCHAR(255),
    sprint VARCHAR(100),
    
    -- Analysis results
    overall_risk risk_level,
    summary_title VARCHAR(500),
    summary_description TEXT,
    complexity VARCHAR(20),
    
    -- Counts for quick queries
    scenarios_count INTEGER DEFAULT 0,
    risks_count INTEGER DEFAULT 0,
    gaps_count INTEGER DEFAULT 0,
    criteria_count INTEGER DEFAULT 0,
    
    -- Raw data (JSON)
    input_data JSONB,
    result_data JSONB,
    
    -- Feedback
    thumbs_up INTEGER DEFAULT 0,
    thumbs_down INTEGER DEFAULT 0,
    was_helpful BOOLEAN,
    
    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    completed_at TIMESTAMP WITH TIME ZONE,
    
    -- Error handling
    error_message TEXT
);

CREATE INDEX idx_analyses_type ON analyses(type);
CREATE INDEX idx_analyses_status ON analyses(status);
CREATE INDEX idx_analyses_repository ON analyses(repository_id);
CREATE INDEX idx_analyses_pr ON analyses(repository_id, pr_number);
CREATE INDEX idx_analyses_created ON analyses(created_at DESC);
CREATE INDEX idx_analyses_risk ON analyses(overall_risk);

-- =============================================================================
-- Table: test_scenarios
-- =============================================================================

CREATE TABLE IF NOT EXISTS test_scenarios (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    analysis_id UUID NOT NULL REFERENCES analyses(id) ON DELETE CASCADE,
    
    scenario_id VARCHAR(20),
    title VARCHAR(500) NOT NULL,
    category VARCHAR(50),
    priority risk_level,
    
    preconditions TEXT[],
    steps TEXT[],
    expected_result TEXT,
    
    test_type VARCHAR(50),
    suggested_test_type VARCHAR(50),
    effort VARCHAR(20),
    
    test_data TEXT[],
    dependencies TEXT[],
    
    heuristic VARCHAR(100),
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_scenarios_analysis ON test_scenarios(analysis_id);
CREATE INDEX idx_scenarios_priority ON test_scenarios(priority);
CREATE INDEX idx_scenarios_category ON test_scenarios(category);

-- =============================================================================
-- Table: risks
-- =============================================================================

CREATE TABLE IF NOT EXISTS risks (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    analysis_id UUID NOT NULL REFERENCES analyses(id) ON DELETE CASCADE,
    
    title VARCHAR(500),
    area VARCHAR(255),
    description TEXT,
    severity risk_level,
    mitigation TEXT,
    affected_areas TEXT[],
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_risks_analysis ON risks(analysis_id);
CREATE INDEX idx_risks_severity ON risks(severity);

-- =============================================================================
-- Table: gaps
-- =============================================================================

CREATE TABLE IF NOT EXISTS gaps (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    analysis_id UUID NOT NULL REFERENCES analyses(id) ON DELETE CASCADE,
    
    title VARCHAR(500),
    description TEXT,
    gap_type VARCHAR(50),
    question TEXT,
    severity risk_level,
    recommendation TEXT,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_gaps_analysis ON gaps(analysis_id);
CREATE INDEX idx_gaps_severity ON gaps(severity);

-- =============================================================================
-- Table: acceptance_criteria
-- =============================================================================

CREATE TABLE IF NOT EXISTS acceptance_criteria (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    analysis_id UUID NOT NULL REFERENCES analyses(id) ON DELETE CASCADE,
    
    criteria_id VARCHAR(20),
    description TEXT NOT NULL,
    criteria_type VARCHAR(50),
    
    gherkin_given TEXT,
    gherkin_when TEXT,
    gherkin_then TEXT,
    
    automatable BOOLEAN DEFAULT false,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_criteria_analysis ON acceptance_criteria(analysis_id);

-- =============================================================================
-- Table: feedback_entries
-- =============================================================================

CREATE TABLE IF NOT EXISTS feedback_entries (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    analysis_id UUID REFERENCES analyses(id) ON DELETE CASCADE,
    
    -- Reactions
    thumbs_up INTEGER DEFAULT 0,
    thumbs_down INTEGER DEFAULT 0,
    heart INTEGER DEFAULT 0,
    confused INTEGER DEFAULT 0,
    rocket INTEGER DEFAULT 0,
    eyes INTEGER DEFAULT 0,
    
    -- Outcome
    pr_merged BOOLEAN,
    pr_merged_at TIMESTAMP WITH TIME ZONE,
    tests_added BOOLEAN DEFAULT false,
    issues_created INTEGER DEFAULT 0,
    
    -- Calculated
    was_helpful BOOLEAN,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_feedback_analysis ON feedback_entries(analysis_id);
CREATE INDEX idx_feedback_helpful ON feedback_entries(was_helpful);

-- =============================================================================
-- Table: generated_tests
-- =============================================================================

CREATE TABLE IF NOT EXISTS generated_tests (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    analysis_id UUID NOT NULL REFERENCES analyses(id) ON DELETE CASCADE,
    
    filename VARCHAR(500),
    framework VARCHAR(50),
    test_type VARCHAR(50),
    code TEXT,
    dependencies TEXT[],
    
    -- PR info if created
    test_pr_number INTEGER,
    test_pr_url VARCHAR(1000),
    test_branch VARCHAR(255),
    commit_sha VARCHAR(40),
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_tests_analysis ON generated_tests(analysis_id);

-- =============================================================================
-- Table: playwright_suggestions
-- =============================================================================

CREATE TABLE IF NOT EXISTS playwright_suggestions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    analysis_id UUID NOT NULL REFERENCES analyses(id) ON DELETE CASCADE,
    
    name VARCHAR(500) NOT NULL,
    description TEXT,
    code TEXT NOT NULL,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_playwright_analysis ON playwright_suggestions(analysis_id);

-- =============================================================================
-- Views
-- =============================================================================

-- View: Analysis summary for quick access
CREATE OR REPLACE VIEW v_analysis_summary AS
SELECT 
    a.id,
    a.type,
    a.status,
    a.overall_risk,
    a.summary_title,
    a.scenarios_count,
    a.risks_count,
    a.gaps_count,
    a.created_at,
    a.completed_at,
    r.full_name as repository,
    a.pr_number,
    a.pr_title,
    a.feature_name,
    a.project_name,
    COALESCE(f.was_helpful, a.was_helpful) as was_helpful,
    (COALESCE(f.thumbs_up, 0) + a.thumbs_up) as total_thumbs_up,
    (COALESCE(f.thumbs_down, 0) + a.thumbs_down) as total_thumbs_down
FROM analyses a
LEFT JOIN repositories r ON a.repository_id = r.id
LEFT JOIN feedback_entries f ON f.analysis_id = a.id;

-- View: Statistics
CREATE OR REPLACE VIEW v_statistics AS
SELECT 
    COUNT(*) as total_analyses,
    COUNT(*) FILTER (WHERE type = 'pr') as pr_analyses,
    COUNT(*) FILTER (WHERE type = 'requirements') as requirements_analyses,
    COUNT(*) FILTER (WHERE status = 'completed') as completed,
    COUNT(*) FILTER (WHERE status = 'failed') as failed,
    AVG(scenarios_count) as avg_scenarios,
    AVG(risks_count) as avg_risks,
    COUNT(*) FILTER (WHERE overall_risk = 'critical') as critical_count,
    COUNT(*) FILTER (WHERE overall_risk = 'high') as high_count,
    COUNT(*) FILTER (WHERE was_helpful = true) as helpful_count,
    COUNT(*) FILTER (WHERE was_helpful = false) as not_helpful_count
FROM analyses;

-- =============================================================================
-- Functions
-- =============================================================================

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Trigger for repositories
CREATE TRIGGER update_repositories_updated_at
    BEFORE UPDATE ON repositories
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Trigger for feedback
CREATE TRIGGER update_feedback_updated_at
    BEFORE UPDATE ON feedback_entries
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- =============================================================================
-- Initial Data
-- =============================================================================

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

CREATE INDEX idx_hotspots_repository ON risk_hotspots(repository_id);
CREATE INDEX idx_hotspots_area ON risk_hotspots(area_name);
CREATE INDEX idx_hotspots_critical ON risk_hotspots(critical_count DESC);
CREATE INDEX idx_hotspots_total ON risk_hotspots(total_risks DESC);

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

-- Insert a test repository (optional)
-- INSERT INTO repositories (owner, name) VALUES ('keelo', 'demo') ON CONFLICT DO NOTHING;

COMMENT ON TABLE analyses IS 'Main table storing all analysis results (PR and requirements)';
COMMENT ON TABLE test_scenarios IS 'Test scenarios generated from analyses';
COMMENT ON TABLE risks IS 'Risks identified during analysis';
COMMENT ON TABLE gaps IS 'Gaps and missing information found in requirements';
COMMENT ON TABLE acceptance_criteria IS 'Acceptance criteria extracted/generated';
COMMENT ON TABLE feedback_entries IS 'User feedback on analyses';
COMMENT ON TABLE generated_tests IS 'Automatically generated test files';
COMMENT ON TABLE risk_hotspots IS 'Aggregated risk data by file/area for hot spot detection';

