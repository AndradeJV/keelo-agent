import { config, logger } from '../../config/index.js';
import { query, queryAll, queryOne, isDatabaseEnabled } from '../connection.js';

export type BugOrigin = 'caught_pre_prod' | 'escaped_prod' | 'unknown';

export interface JiraBugEvent {
  issueKey: string;
  summary: string;
  status: string;
  labels: string[];
  createdAt: string;
  resolvedAt: string | null;
}

export interface WeeklyJiraBugStats {
  caughtBeforeProd: number;
  escapedToProd: number;
  total: number;
  highlights: string[];
}

export function classifyBugOrigin(labels: string[]): BugOrigin {
  const normalized = labels.map((label) => label.toLowerCase());
  const caughtLabel = config.jira.labels.caughtPreProd.toLowerCase();
  const escapedLabel = config.jira.labels.escapedProd.toLowerCase();

  if (normalized.includes(caughtLabel)) {
    return 'caught_pre_prod';
  }
  if (normalized.includes(escapedLabel)) {
    return 'escaped_prod';
  }
  return 'unknown';
}

function classifyBugStatus(status: string): 'open' | 'resolved' | 'unknown' {
  const normalized = status.toLowerCase();
  if (normalized.includes('done') || normalized.includes('resolved') || normalized.includes('closed')) {
    return 'resolved';
  }
  if (normalized) {
    return 'open';
  }
  return 'unknown';
}

export async function upsertJiraBugEvents(events: JiraBugEvent[]): Promise<number> {
  if (!isDatabaseEnabled() || events.length === 0) {
    return 0;
  }

  let count = 0;
  for (const event of events) {
    const bugOrigin = classifyBugOrigin(event.labels);
    const bugStatus = classifyBugStatus(event.status);

    await query(
      `
      INSERT INTO jira_bug_events (
        issue_key,
        summary,
        status,
        created_at_jira,
        resolved_at_jira,
        labels,
        bug_origin,
        bug_status,
        last_synced_at
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,NOW())
      ON CONFLICT (issue_key) DO UPDATE SET
        summary = EXCLUDED.summary,
        status = EXCLUDED.status,
        created_at_jira = EXCLUDED.created_at_jira,
        resolved_at_jira = EXCLUDED.resolved_at_jira,
        labels = EXCLUDED.labels,
        bug_origin = EXCLUDED.bug_origin,
        bug_status = EXCLUDED.bug_status,
        last_synced_at = NOW()
      `,
      [
        event.issueKey,
        event.summary,
        event.status,
        event.createdAt,
        event.resolvedAt,
        event.labels,
        bugOrigin,
        bugStatus,
      ]
    );
    count += 1;
  }

  logger.info({ count }, 'Upserted Jira bug events');
  return count;
}

export async function getWeeklyJiraBugStats(
  startISO: string,
  endISO: string
): Promise<WeeklyJiraBugStats> {
  if (!isDatabaseEnabled()) {
    return {
      caughtBeforeProd: 0,
      escapedToProd: 0,
      total: 0,
      highlights: [],
    };
  }

  try {
    const summary = await queryOne<{
      caught: string;
      escaped: string;
      total: string;
    }>(
      `
      SELECT
        COUNT(*) FILTER (WHERE bug_origin = 'caught_pre_prod') AS caught,
        COUNT(*) FILTER (WHERE bug_origin = 'escaped_prod') AS escaped,
        COUNT(*) AS total
      FROM jira_bug_events
      WHERE created_at_jira >= $1 AND created_at_jira <= $2
      `,
      [startISO, endISO]
    );

    const highlightsRows = await queryAll<{ summary: string }>(
      `
      SELECT summary
      FROM jira_bug_events
      WHERE created_at_jira >= $1 AND created_at_jira <= $2
        AND bug_origin IN ('caught_pre_prod', 'escaped_prod')
      ORDER BY created_at_jira DESC
      LIMIT 2
      `,
      [startISO, endISO]
    );

    return {
      caughtBeforeProd: Number(summary?.caught || 0),
      escapedToProd: Number(summary?.escaped || 0),
      total: Number(summary?.total || 0),
      highlights: highlightsRows.map((item) => item.summary),
    };
  } catch (error) {
    logger.warn({ error }, 'jira_bug_events table unavailable; returning empty Jira stats');
    return {
      caughtBeforeProd: 0,
      escapedToProd: 0,
      total: 0,
      highlights: [],
    };
  }
}

export async function hasWeeklyReportBeenSent(reportKey: string): Promise<boolean> {
  if (!isDatabaseEnabled()) {
    return false;
  }

  const result = await queryOne<{ report_key: string }>(
    'SELECT report_key FROM weekly_reports_sent WHERE report_key = $1',
    [reportKey]
  );
  return Boolean(result);
}

export async function markWeeklyReportSent(reportKey: string, payload: Record<string, unknown>): Promise<void> {
  if (!isDatabaseEnabled()) {
    return;
  }

  await query(
    `
    INSERT INTO weekly_reports_sent (report_key, payload)
    VALUES ($1, $2)
    ON CONFLICT (report_key) DO NOTHING
    `,
    [reportKey, JSON.stringify(payload)]
  );
}

