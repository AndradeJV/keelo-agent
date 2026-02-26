-- =============================================================================
-- Migration: Add Settings Table
-- Description: Stores Keelo configuration in database for dashboard management
-- =============================================================================

-- Settings table (key-value with JSON support)
CREATE TABLE IF NOT EXISTS keelo_settings (
    id SERIAL PRIMARY KEY,
    key VARCHAR(100) UNIQUE NOT NULL,
    value JSONB NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_by VARCHAR(255) DEFAULT 'system'
);

-- Create index for fast lookups
CREATE INDEX IF NOT EXISTS idx_keelo_settings_key ON keelo_settings(key);

-- Insert default configuration if not exists
INSERT INTO keelo_settings (key, value, updated_by)
VALUES ('config', '{
  "language": "pt-br",
  "trigger": "auto",
  "llm": {
    "provider": "anthropic",
    "model": "claude-sonnet-4-20250514",
    "temperature": 0.2,
    "maxTokens": 16000
  },
  "testFrameworks": {
    "e2e": "playwright",
    "unit": "vitest",
    "api": "supertest"
  },
  "actions": {
    "autoGenerateTests": true,
    "autoCreateIssues": false,
    "autoCreateTasks": false,
    "createDraftPRs": true,
    "issueLabels": ["keelo", "qa", "automated"],
    "autonomous": {
      "enabled": true,
      "createPR": true,
      "monitorCI": true,
      "autoFix": false,
      "baseBranchStrategy": "default"
    }
  },
  "runtime": {
    "enabled": false,
    "schedule": "0 3 * * *",
    "timezone": "America/Sao_Paulo",
    "maxPages": 50,
    "maxDepth": 3,
    "environments": {},
    "criticalFlows": []
  },
  "notifications": {
    "slack": {
      "enabled": false,
      "webhookUrl": "",
      "channel": "#qa-alerts",
      "notifyOn": {
        "analysis": true,
        "testPRCreated": true,
        "ciFailure": true,
        "criticalRisk": true
      }
    }
  },
  "coverage": {
    "enabled": true,
    "minThreshold": 80,
    "failOnDecrease": false,
    "suggestTests": true
  },
  "feedback": {
    "enabled": true,
    "collectReactions": true,
    "useLearning": true,
    "showStats": true
  },
  "testOutputDir": "tests/generated"
}'::jsonb, 'migration')
ON CONFLICT (key) DO NOTHING;

