CREATE TABLE IF NOT EXISTS jira_bug_events (
    issue_key VARCHAR(64) PRIMARY KEY,
    summary TEXT NOT NULL,
    status VARCHAR(64) NOT NULL,
    created_at_jira TIMESTAMP WITH TIME ZONE NOT NULL,
    resolved_at_jira TIMESTAMP WITH TIME ZONE,
    labels TEXT[] DEFAULT '{}',
    bug_origin VARCHAR(20) NOT NULL CHECK (bug_origin IN ('caught_pre_prod', 'escaped_prod', 'unknown')),
    bug_status VARCHAR(20) NOT NULL CHECK (bug_status IN ('open', 'resolved', 'unknown')),
    first_seen_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    last_synced_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_jira_bug_origin ON jira_bug_events(bug_origin);
CREATE INDEX IF NOT EXISTS idx_jira_bug_created ON jira_bug_events(created_at_jira DESC);
CREATE INDEX IF NOT EXISTS idx_jira_bug_resolved ON jira_bug_events(resolved_at_jira DESC);

CREATE TABLE IF NOT EXISTS weekly_reports_sent (
    report_key VARCHAR(32) PRIMARY KEY,
    sent_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    payload JSONB NOT NULL DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS idx_weekly_reports_sent_at ON weekly_reports_sent(sent_at DESC);

