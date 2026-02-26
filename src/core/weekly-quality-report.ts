import { config, getSlackConfig, logger } from '../config/index.js';
import {
  getQAHealthMetrics,
  getSettings,
  getWeeklyJiraBugStats,
  hasWeeklyReportBeenSent,
  isDatabaseEnabled,
  markWeeklyReportSent,
  queryAll,
  queryOne,
  upsertJiraBugEvents,
} from '../database/index.js';
import { fetchJiraBugsForPeriod, isJiraConfigured } from '../integrations/jira/index.js';
import { sendWeeklyQualityReport } from '../integrations/slack/index.js';
import { buildQualitySignal, calculateAcceptanceRate, getWeeklyWindow, type DataQualitySignal } from './metrics-utils.js';

export interface WeeklyQualityReport {
  dateRange: { start: string; end: string };
  prsAnalyzed: number;
  testsGenerated: number;
  testAcceptanceRate: number;
  bugsCaughtBeforeProduction: number;
  bugsEscapedToProduction: number;
  criticalFlowCoverage: { covered: number; total: number };
  highlights: string[];
  nextWeekAction: string;
  dataQuality: {
    jira: DataQualitySignal;
    tests: DataQualitySignal;
  };
}

async function getCriticalFlowCoverage(startISO: string): Promise<{ covered: number; total: number }> {
  const settings = await getSettings();
  const criticalFlows = settings.runtime?.criticalFlows || [];
  if (criticalFlows.length === 0) {
    return { covered: 0, total: 0 };
  }

  const rows = await queryAll<{ title: string }>(
    `
    SELECT ts.title
    FROM test_scenarios ts
    JOIN analyses a ON a.id = ts.analysis_id
    WHERE a.created_at >= $1
    `,
    [startISO]
  );

  const lowerTitles = rows.map((row) => row.title.toLowerCase());
  const covered = criticalFlows.filter((flow) =>
    lowerTitles.some((title) => title.includes(flow.name.toLowerCase()))
  ).length;
  return { covered, total: criticalFlows.length };
}

async function getTestAcceptanceRate(startISO: string): Promise<number> {
  const row = await queryOne<{ accepted: string; total: string }>(
    `
    SELECT
      COUNT(*) FILTER (WHERE fe.tests_added = true) AS accepted,
      COUNT(*) AS total
    FROM analyses a
    LEFT JOIN feedback_entries fe ON fe.analysis_id = a.id
    WHERE a.type = 'pr'
      AND a.created_at >= $1
      AND a.scenarios_count > 0
    `,
    [startISO]
  );

  const accepted = Number(row?.accepted || 0);
  const total = Number(row?.total || 0);
  return calculateAcceptanceRate(accepted, total);
}

async function getKeeloHighlights(startISO: string): Promise<string[]> {
  const rows = await queryAll<{ pr_title: string; overall_risk: string }>(
    `
    SELECT pr_title, overall_risk
    FROM analyses
    WHERE type = 'pr'
      AND created_at >= $1
      AND scenarios_count > 0
      AND overall_risk IN ('critical', 'high')
    ORDER BY created_at DESC
    LIMIT 2
    `,
    [startISO]
  );

  return rows.map((row) => `${row.pr_title} (${row.overall_risk})`);
}

function suggestCalibrationAction(report: {
  acceptanceRate: number;
  escapedBugs: number;
  criticalCoverage: { covered: number; total: number };
}): string {
  if (report.escapedBugs > 0) {
    return 'Calibrar prompts para reduzir escapes: reforcar checagens de regressao e fluxos de producao.';
  }
  if (report.criticalCoverage.total > 0 && report.criticalCoverage.covered < report.criticalCoverage.total) {
    return 'Calibrar mapeamento de fluxos criticos e aumentar geracao de testes para os fluxos sem cobertura.';
  }
  if (report.acceptanceRate < 60) {
    return 'Calibrar qualidade dos testes gerados: reduzir flakiness e ajustar estrategia de dados de teste.';
  }
  return 'Calibrar granularidade dos riscos e foco em produtividade para manter taxa de aceitacao alta.';
}

export async function generateWeeklyQualityReport(): Promise<WeeklyQualityReport> {
  const { startISO, endISO } = getWeeklyWindow();

  let jiraFresh = false;
  if (isJiraConfigured()) {
    const jiraBugs = await fetchJiraBugsForPeriod(startISO, endISO);
    await upsertJiraBugEvents(
      jiraBugs.map((item) => ({
        issueKey: item.key,
        summary: item.summary,
        status: item.status,
        labels: item.labels,
        createdAt: item.createdAt,
        resolvedAt: item.resolvedAt,
      }))
    );
    jiraFresh = jiraBugs.length > 0;
  }

  const qa = await getQAHealthMetrics('weekly');
  const jira = await getWeeklyJiraBugStats(startISO, endISO);
  const acceptanceRate = await getTestAcceptanceRate(startISO);
  const criticalCoverage = await getCriticalFlowCoverage(startISO);
  const highlights = jira.highlights.length > 0 ? jira.highlights : await getKeeloHighlights(startISO);
  const nextWeekAction = suggestCalibrationAction({
    acceptanceRate,
    escapedBugs: jira.escapedToProd,
    criticalCoverage,
  });

  return {
    dateRange: {
      start: startISO.slice(0, 10),
      end: endISO.slice(0, 10),
    },
    prsAnalyzed: qa?.totalPRsAnalyzed || 0,
    testsGenerated: qa?.testsGenerated || 0,
    testAcceptanceRate: acceptanceRate,
    bugsCaughtBeforeProduction: jira.caughtBeforeProd,
    bugsEscapedToProduction: jira.escapedToProd,
    criticalFlowCoverage: criticalCoverage,
    highlights,
    nextWeekAction,
    dataQuality: {
      jira: buildQualitySignal('jira', isJiraConfigured(), !jiraFresh),
      tests: buildQualitySignal('feedback_entries', true, false, [
        'Acceptance is based on tests_added feedback proxy',
      ]),
    },
  };
}

export async function runWeeklyQualityReport(force = false): Promise<boolean> {
  if (!isDatabaseEnabled()) {
    logger.warn('Weekly report skipped: database is disabled');
    return false;
  }

  const slackConfig = getSlackConfig();
  if (!slackConfig.enabled || !slackConfig.webhookUrl) {
    logger.warn('Weekly report skipped: Slack webhook is not configured');
    return false;
  }

  const { reportKey } = getWeeklyWindow();
  if (!force && (await hasWeeklyReportBeenSent(reportKey))) {
    logger.info({ reportKey }, 'Weekly report already sent');
    return true;
  }

  const report = await generateWeeklyQualityReport();
  const sent = await sendWeeklyQualityReport(slackConfig.webhookUrl, report);
  if (!sent) {
    return false;
  }

  await markWeeklyReportSent(reportKey, {
    ...report,
    timezone: config.reports.weekly.timezone,
  });

  return true;
}

