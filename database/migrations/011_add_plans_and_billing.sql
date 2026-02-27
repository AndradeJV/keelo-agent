-- =============================================================================
-- Migration 011: Add plans, subscriptions, and usage tracking for billing
-- =============================================================================

-- =============================================================================
-- Table: plans — Available subscription plans
-- =============================================================================

CREATE TABLE IF NOT EXISTS plans (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(50) NOT NULL UNIQUE,          -- 'starter', 'growth', 'professional', 'enterprise'
    display_name VARCHAR(100) NOT NULL,         -- 'Starter', 'Growth', 'Professional', 'Enterprise'
    price_cents INTEGER NOT NULL DEFAULT 0,     -- Price in BRL cents (0, 59700, 149700, 399700)
    currency VARCHAR(3) NOT NULL DEFAULT 'BRL',
    billing_period VARCHAR(20) DEFAULT 'monthly', -- 'monthly', 'yearly'
    max_analyses INTEGER,                       -- NULL = unlimited
    max_projects INTEGER,
    max_members INTEGER,
    max_organizations INTEGER,
    features JSONB DEFAULT '{}',                -- { "sonnet": true, "chat": true, "github_app": true, ... }
    is_active BOOLEAN DEFAULT TRUE,
    sort_order INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================================================
-- Table: subscriptions — Organization's active plan
-- =============================================================================

CREATE TABLE IF NOT EXISTS subscriptions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    plan_id UUID NOT NULL REFERENCES plans(id),
    status VARCHAR(20) NOT NULL DEFAULT 'active',  -- 'active', 'canceled', 'past_due', 'trialing', 'expired'
    payment_provider VARCHAR(20),                   -- 'stripe', 'mercadopago', NULL (free)
    provider_subscription_id VARCHAR(255),           -- Stripe subscription ID
    provider_customer_id VARCHAR(255),               -- Stripe customer ID
    current_period_start TIMESTAMPTZ,
    current_period_end TIMESTAMPTZ,
    trial_ends_at TIMESTAMPTZ,
    canceled_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),

    -- Only one active subscription per org
    CONSTRAINT unique_active_subscription 
        UNIQUE (organization_id) 
);

CREATE INDEX IF NOT EXISTS idx_subscriptions_org ON subscriptions(organization_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_status ON subscriptions(status);
CREATE INDEX IF NOT EXISTS idx_subscriptions_provider ON subscriptions(payment_provider, provider_subscription_id);

-- =============================================================================
-- Table: usage_tracking — Monthly usage counters per organization
-- =============================================================================

CREATE TABLE IF NOT EXISTS usage_tracking (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    period_start DATE NOT NULL,           -- 1st day of the month
    period_end DATE NOT NULL,             -- Last day of the month
    analyses_used INTEGER DEFAULT 0,
    analyses_limit INTEGER NOT NULL,
    projects_used INTEGER DEFAULT 0,
    projects_limit INTEGER NOT NULL DEFAULT 0,
    members_used INTEGER DEFAULT 0,
    members_limit INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),

    UNIQUE(organization_id, period_start)
);

CREATE INDEX IF NOT EXISTS idx_usage_tracking_org ON usage_tracking(organization_id);
CREATE INDEX IF NOT EXISTS idx_usage_tracking_period ON usage_tracking(organization_id, period_start);

-- =============================================================================
-- Seed default plans
-- =============================================================================

INSERT INTO plans (name, display_name, price_cents, max_analyses, max_projects, max_members, max_organizations, sort_order, features)
VALUES
    ('starter', 'Starter', 0, 5, 1, 1, 1, 1, 
     '{"model": "haiku", "history_days": 7, "chat": false, "github_app": false, "reports_pdf": false, "api_webhooks": false, "ci_cd": false, "sso": false}'::jsonb),
    ('growth', 'Growth', 59700, 150, 5, 5, 1, 2, 
     '{"model": "sonnet", "history_days": 180, "chat": true, "chat_limit": 5, "github_app": true, "reports_pdf": false, "api_webhooks": false, "ci_cd": false, "sso": false}'::jsonb),
    ('professional', 'Professional', 149700, 500, 25, 25, 3, 3, 
     '{"model": "sonnet", "history_days": 730, "chat": true, "chat_limit": -1, "github_app": true, "reports_pdf": true, "api_webhooks": true, "ci_cd": true, "sso": false}'::jsonb),
    ('enterprise', 'Enterprise', 399700, NULL, NULL, NULL, NULL, 4, 
     '{"model": "sonnet", "history_days": -1, "chat": true, "chat_limit": -1, "github_app": true, "reports_pdf": true, "api_webhooks": true, "ci_cd": true, "sso": true}'::jsonb)
ON CONFLICT (name) DO NOTHING;

-- =============================================================================
-- Add plan_id to organizations (default to starter)
-- =============================================================================

ALTER TABLE organizations ADD COLUMN IF NOT EXISTS plan_id UUID REFERENCES plans(id);

-- Set existing orgs to starter plan
UPDATE organizations 
SET plan_id = (SELECT id FROM plans WHERE name = 'starter')
WHERE plan_id IS NULL;

-- =============================================================================
-- Triggers
-- =============================================================================

CREATE OR REPLACE FUNCTION update_usage_on_analysis() RETURNS TRIGGER AS $$
BEGIN
    IF NEW.organization_id IS NOT NULL AND NEW.status = 'completed' THEN
        INSERT INTO usage_tracking (organization_id, period_start, period_end, analyses_used, analyses_limit)
        VALUES (
            NEW.organization_id,
            date_trunc('month', CURRENT_DATE)::date,
            (date_trunc('month', CURRENT_DATE) + interval '1 month - 1 day')::date,
            1,
            COALESCE(
                (SELECT p.max_analyses FROM plans p 
                 JOIN organizations o ON o.plan_id = p.id 
                 WHERE o.id = NEW.organization_id),
                999999
            )
        )
        ON CONFLICT (organization_id, period_start) 
        DO UPDATE SET 
            analyses_used = usage_tracking.analyses_used + 1,
            updated_at = NOW();
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_usage_on_analysis ON analyses;
CREATE TRIGGER trigger_usage_on_analysis
    AFTER INSERT OR UPDATE ON analyses
    FOR EACH ROW
    WHEN (NEW.status = 'completed')
    EXECUTE FUNCTION update_usage_on_analysis();

-- =============================================================================
-- Comments
-- =============================================================================

COMMENT ON TABLE plans IS 'Available subscription plans (Starter, Growth, Professional, Enterprise)';
COMMENT ON TABLE subscriptions IS 'Organization subscription records, linked to payment provider';
COMMENT ON TABLE usage_tracking IS 'Monthly usage counters per organization for enforcing limits';
COMMENT ON COLUMN plans.price_cents IS 'Price in BRL cents. E.g. 59700 = R$597.00';
COMMENT ON COLUMN plans.features IS 'JSON object of feature flags: model, chat, github_app, reports_pdf, etc.';
COMMENT ON COLUMN subscriptions.status IS 'active, canceled, past_due, trialing, expired';
COMMENT ON COLUMN usage_tracking.analyses_used IS 'Number of completed analyses this period';

