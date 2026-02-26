import { getQAHealthMetrics, getWeeklyJiraBugStats, isDatabaseEnabled } from '../database/index.js';
import { buildQualitySignal, type DataQualitySignal } from './metrics-utils.js';

export type AudienceRole = 'cto' | 'pm' | 'qa';

export interface AudienceMetricCard {
  id: string;
  title: string;
  value: string;
  detail?: string;
}

export interface AudienceMetricsResponse {
  audience: AudienceRole;
  period: 'daily' | 'weekly' | 'monthly';
  cards: AudienceMetricCard[];
  dataQuality: Record<string, DataQualitySignal>;
}

export async function getAudienceMetrics(
  audience: AudienceRole,
  period: 'daily' | 'weekly' | 'monthly' = 'weekly'
): Promise<AudienceMetricsResponse> {
  if (!isDatabaseEnabled()) {
    return {
      audience,
      period,
      cards: [],
      dataQuality: {
        database: buildQualitySignal('database', false, false),
      },
    };
  }

  const qa = await getQAHealthMetrics(period);
  const startISO = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const endISO = new Date().toISOString();
  const jira = await getWeeklyJiraBugStats(startISO, endISO);

  const baseCardsByAudience: Record<AudienceRole, AudienceMetricCard[]> = {
    cto: [
      {
        id: 'risk-trend',
        title: 'Riscos críticos/altos',
        value: `${(qa?.risks.critical || 0) + (qa?.risks.high || 0)}`,
        detail: `Total riscos: ${qa?.risks.total || 0}`,
      },
      {
        id: 'escaped-bugs',
        title: 'Bugs escapados para produção',
        value: `${jira.escapedToProd}`,
      },
      {
        id: 'quality-throughput',
        title: 'PRs analisados',
        value: `${qa?.totalPRsAnalyzed || 0}`,
      },
    ],
    pm: [
      {
        id: 'bugs-before-prod',
        title: 'Bugs pegos antes da produção',
        value: `${jira.caughtBeforeProd}`,
      },
      {
        id: 'critical-flow',
        title: 'Fluxos com risco elevado',
        value: `${qa?.risks.critical || 0}`,
        detail: `Riscos altos: ${qa?.risks.high || 0}`,
      },
      {
        id: 'tests-generated',
        title: 'Testes gerados',
        value: `${qa?.testsGenerated || 0}`,
      },
    ],
    qa: [
      {
        id: 'coverage',
        title: 'Cobertura média',
        value: `${qa?.coverage.average || 0}%`,
      },
      {
        id: 'hotspots',
        title: 'Hot spots',
        value: `${qa?.hotSpots.length || 0}`,
      },
      {
        id: 'prs-without-tests',
        title: 'PRs sem testes',
        value: `${qa?.prsWithoutTests.length || 0}`,
      },
    ],
  };

  return {
    audience,
    period,
    cards: baseCardsByAudience[audience],
    dataQuality: {
      qaMetrics: buildQualitySignal('keelo_database', true, false),
      jira: buildQualitySignal('jira', jira.total > 0, jira.total === 0),
    },
  };
}

