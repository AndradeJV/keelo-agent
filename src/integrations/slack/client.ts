import { logger } from '../../config/index.js';
import type { AnalysisResult, PullRequestContext } from '../../core/types.js';
import type { CreatedPullRequest } from '../github/pr-creator.js';

// =============================================================================
// Types
// =============================================================================

export interface SlackConfig {
  enabled: boolean;
  webhookUrl: string;
  channel?: string;
  notifyOn: {
    analysis: boolean;
    testPRCreated: boolean;
    ciFailure: boolean;
    criticalRisk: boolean;
  };
}

interface SlackMessage {
  text?: string;
  blocks?: SlackBlock[];
  attachments?: SlackAttachment[];
}

interface SlackBlock {
  type: string;
  text?: {
    type: string;
    text: string;
    emoji?: boolean;
  };
  elements?: unknown[];
  fields?: { type: string; text: string }[];
}

interface SlackAttachment {
  color: string;
  blocks?: SlackBlock[];
}

// =============================================================================
// Slack Notification Sender
// =============================================================================

export async function sendSlackNotification(
  webhookUrl: string,
  message: SlackMessage
): Promise<boolean> {
  try {
    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(message),
    });

    if (!response.ok) {
      logger.error({ status: response.status }, 'Failed to send Slack notification');
      return false;
    }

    logger.info('Slack notification sent successfully');
    return true;
  } catch (error) {
    logger.error({ error }, 'Error sending Slack notification');
    return false;
  }
}

// =============================================================================
// Notification Builders
// =============================================================================

export function buildAnalysisNotification(
  analysis: AnalysisResult,
  context: PullRequestContext,
  prUrl: string
): SlackMessage {
  const riskEmoji = {
    critical: '🔴',
    high: '🟠',
    medium: '🟡',
    low: '🟢',
  };

  const riskColor = {
    critical: '#dc2626',
    high: '#ea580c',
    medium: '#ca8a04',
    low: '#16a34a',
  };

  return {
    blocks: [
      {
        type: 'header',
        text: {
          type: 'plain_text',
          text: '🤖 Keelo - Nova Análise de PR',
          emoji: true,
        },
      },
      {
        type: 'section',
        fields: [
          {
            type: 'mrkdwn',
            text: `*Repositório:*\n${context.owner}/${context.repo}`,
          },
          {
            type: 'mrkdwn',
            text: `*PR:*\n<${prUrl}|#${context.pullNumber}>`,
          },
        ],
      },
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `*${analysis.summary.title}*\n${analysis.summary.description.substring(0, 200)}...`,
        },
      },
      {
        type: 'section',
        fields: [
          {
            type: 'mrkdwn',
            text: `*Risco Geral:*\n${riskEmoji[analysis.overallRisk]} ${analysis.overallRisk.toUpperCase()}`,
          },
          {
            type: 'mrkdwn',
            text: `*Cenários:*\n${analysis.scenarios.length} identificados`,
          },
        ],
      },
    ],
    attachments: [
      {
        color: riskColor[analysis.overallRisk],
        blocks: [
          {
            type: 'section',
            text: {
              type: 'mrkdwn',
              text: analysis.gaps.length > 0 
                ? `⚠️ *${analysis.gaps.length} gaps funcionais* encontrados`
                : '✅ Nenhum gap funcional crítico',
            },
          },
        ],
      },
    ],
  };
}

export function buildTestPRNotification(
  context: PullRequestContext,
  testPR: CreatedPullRequest,
  testsCount: number
): SlackMessage {
  return {
    blocks: [
      {
        type: 'header',
        text: {
          type: 'plain_text',
          text: '🧪 Keelo - Testes Automatizados Gerados',
          emoji: true,
        },
      },
      {
        type: 'section',
        fields: [
          {
            type: 'mrkdwn',
            text: `*Repositório:*\n${context.owner}/${context.repo}`,
          },
          {
            type: 'mrkdwn',
            text: `*PR Original:*\n#${context.pullNumber}`,
          },
        ],
      },
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `✅ *${testsCount} arquivos de teste* foram gerados automaticamente!`,
        },
      },
      {
        type: 'section',
        fields: [
          {
            type: 'mrkdwn',
            text: `*PR de Testes:*\n<${testPR.url}|#${testPR.number}>`,
          },
          {
            type: 'mrkdwn',
            text: `*Branch:*\n\`${testPR.branch}\``,
          },
        ],
      },
      {
        type: 'actions',
        elements: [
          {
            type: 'button',
            text: {
              type: 'plain_text',
              text: '📝 Ver PR de Testes',
              emoji: true,
            },
            url: testPR.url,
          },
        ],
      },
    ],
  };
}

export function buildCIFailureNotification(
  context: PullRequestContext,
  prNumber: number,
  failedChecks: string[]
): SlackMessage {
  return {
    blocks: [
      {
        type: 'header',
        text: {
          type: 'plain_text',
          text: '❌ Keelo - Falha no CI',
          emoji: true,
        },
      },
      {
        type: 'section',
        fields: [
          {
            type: 'mrkdwn',
            text: `*Repositório:*\n${context.owner}/${context.repo}`,
          },
          {
            type: 'mrkdwn',
            text: `*PR de Testes:*\n#${prNumber}`,
          },
        ],
      },
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `🚨 *${failedChecks.length} check(s) falharam:*\n${failedChecks.map(c => `• ${c}`).join('\n')}`,
        },
      },
    ],
    attachments: [
      {
        color: '#dc2626',
        blocks: [
          {
            type: 'section',
            text: {
              type: 'mrkdwn',
              text: 'Por favor, revise os testes gerados e corrija os problemas.',
            },
          },
        ],
      },
    ],
  };
}

export function buildCriticalRiskNotification(
  context: PullRequestContext,
  prUrl: string,
  risks: { area: string; description: string }[]
): SlackMessage {
  return {
    blocks: [
      {
        type: 'header',
        text: {
          type: 'plain_text',
          text: '🔴 Keelo - Risco Crítico Detectado',
          emoji: true,
        },
      },
      {
        type: 'section',
        fields: [
          {
            type: 'mrkdwn',
            text: `*Repositório:*\n${context.owner}/${context.repo}`,
          },
          {
            type: 'mrkdwn',
            text: `*PR:*\n<${prUrl}|#${context.pullNumber}>`,
          },
        ],
      },
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `⚠️ *${risks.length} risco(s) crítico(s) identificado(s):*`,
        },
      },
      ...risks.slice(0, 3).map(risk => ({
        type: 'section' as const,
        text: {
          type: 'mrkdwn' as const,
          text: `• *${risk.area}:* ${risk.description}`,
        },
      })),
    ],
    attachments: [
      {
        color: '#dc2626',
        blocks: [
          {
            type: 'section',
            text: {
              type: 'mrkdwn',
              text: '🚨 *Ação requerida:* Este PR requer atenção especial antes do merge.',
            },
          },
        ],
      },
    ],
  };
}

// =============================================================================
// Requirements Analysis Notification
// =============================================================================

export interface RequirementsAnalysisNotificationData {
  analysisId: string;
  featureName: string;
  projectName?: string;
  sprint?: string;
  scenariosCount: number;
  risksCount: number;
  gapsCount: number;
  overallRisk?: 'critical' | 'high' | 'medium' | 'low';
  summaryTitle?: string;
  dashboardUrl: string;
}

export function buildRequirementsAnalysisNotification(
  data: RequirementsAnalysisNotificationData
): SlackMessage {
  const riskEmoji = {
    critical: '🔴',
    high: '🟠',
    medium: '🟡',
    low: '🟢',
  };

  const riskColor = {
    critical: '#dc2626',
    high: '#ea580c',
    medium: '#ca8a04',
    low: '#16a34a',
  };

  const risk = data.overallRisk || 'medium';

  return {
    blocks: [
      {
        type: 'header',
        text: {
          type: 'plain_text',
          text: '🤖 Keelo - Análise de Requisitos Concluída',
          emoji: true,
        },
      },
      {
        type: 'section',
        fields: [
          {
            type: 'mrkdwn',
            text: `*Feature:*\n${data.featureName}`,
          },
          {
            type: 'mrkdwn',
            text: `*Projeto:*\n${data.projectName || 'Não especificado'}`,
          },
        ],
      },
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: data.summaryTitle ? `*${data.summaryTitle}*` : '*Análise de Requisitos*',
        },
      },
      {
        type: 'section',
        fields: [
          {
            type: 'mrkdwn',
            text: `*Cenários:*\n📋 ${data.scenariosCount} identificados`,
          },
          {
            type: 'mrkdwn',
            text: `*Riscos:*\n⚠️ ${data.risksCount} encontrados`,
          },
          {
            type: 'mrkdwn',
            text: `*Gaps:*\n❓ ${data.gapsCount} perguntas`,
          },
          {
            type: 'mrkdwn',
            text: `*Risco Geral:*\n${riskEmoji[risk]} ${risk.toUpperCase()}`,
          },
        ],
      },
      {
        type: 'actions',
        elements: [
          {
            type: 'button',
            text: {
              type: 'plain_text',
              text: '📊 Ver Análise Completa',
              emoji: true,
            },
            url: data.dashboardUrl,
            style: 'primary',
          },
        ],
      },
    ],
    attachments: [
      {
        color: riskColor[risk],
        blocks: [
          {
            type: 'context',
            elements: [
              {
                type: 'mrkdwn',
                text: data.sprint 
                  ? `Sprint: ${data.sprint} | ID: ${data.analysisId.substring(0, 8)}`
                  : `ID: ${data.analysisId.substring(0, 8)}`,
              },
            ],
          },
        ],
      },
    ],
  };
}

export async function notifyRequirementsAnalysisComplete(
  webhookUrl: string,
  data: RequirementsAnalysisNotificationData
): Promise<boolean> {
  if (!webhookUrl) {
    logger.debug('No Slack webhook URL configured');
    return false;
  }

  const message = buildRequirementsAnalysisNotification(data);
  return sendSlackNotification(webhookUrl, message);
}

// =============================================================================
// Main Notification Handler
// =============================================================================

export async function notifySlack(
  config: SlackConfig,
  type: 'analysis' | 'testPR' | 'ciFailure' | 'criticalRisk',
  data: {
    analysis?: AnalysisResult;
    context: PullRequestContext;
    prUrl?: string;
    testPR?: CreatedPullRequest;
    testsCount?: number;
    failedChecks?: string[];
  }
): Promise<void> {
  if (!config.enabled || !config.webhookUrl) {
    return;
  }

  let message: SlackMessage | null = null;

  switch (type) {
    case 'analysis':
      if (config.notifyOn.analysis && data.analysis && data.prUrl) {
        message = buildAnalysisNotification(data.analysis, data.context, data.prUrl);
      }
      break;

    case 'testPR':
      if (config.notifyOn.testPRCreated && data.testPR) {
        message = buildTestPRNotification(data.context, data.testPR, data.testsCount || 0);
      }
      break;

    case 'ciFailure':
      if (config.notifyOn.ciFailure && data.failedChecks && data.testPR) {
        message = buildCIFailureNotification(data.context, data.testPR.number, data.failedChecks);
      }
      break;

    case 'criticalRisk':
      if (config.notifyOn.criticalRisk && data.analysis && data.prUrl) {
        const criticalRisks = data.analysis.risks.filter(r => r.level === 'critical');
        if (criticalRisks.length > 0) {
          message = buildCriticalRiskNotification(data.context, data.prUrl, criticalRisks);
        }
      }
      break;
  }

  if (message) {
    await sendSlackNotification(config.webhookUrl, message);
  }
}

// =============================================================================
// Action Report Notification (Detailed summary of all Keelo actions)
// =============================================================================

export interface KeeloActionReport {
  repository: string;
  prNumber: number;
  prTitle: string;
  prUrl: string;
  analysisId?: string;
  
  // Actions taken
  actions: {
    analyzed: boolean;
    testsGenerated: number;
    testPRCreated?: {
      number: number;
      url: string;
      branch: string;
    };
    ciStatus?: 'pending' | 'success' | 'failure';
    issuesCreated?: number;
    risksIdentified: number;
    gapsFound: number;
  };
  
  // Metrics
  overallRisk: 'critical' | 'high' | 'medium' | 'low';
  scenariosCount: number;
  
  // Dashboard link
  dashboardUrl?: string;
}

export function buildActionReportNotification(report: KeeloActionReport): SlackMessage {
  const riskEmoji = {
    critical: '🔴',
    high: '🟠',
    medium: '🟡',
    low: '🟢',
  };

  const riskColor = {
    critical: '#dc2626',
    high: '#ea580c',
    medium: '#ca8a04',
    low: '#16a34a',
  };

  // Build actions summary
  const actionLines: string[] = [];
  
  if (report.actions.analyzed) {
    actionLines.push('✅ Análise de PR concluída');
  }
  
  if (report.actions.testsGenerated > 0) {
    actionLines.push(`🧪 ${report.actions.testsGenerated} teste(s) gerado(s)`);
  }
  
  if (report.actions.testPRCreated) {
    actionLines.push(`📝 PR de Testes criado: <${report.actions.testPRCreated.url}|#${report.actions.testPRCreated.number}>`);
  }
  
  if (report.actions.ciStatus) {
    const ciEmoji = report.actions.ciStatus === 'success' ? '✅' : 
                    report.actions.ciStatus === 'failure' ? '❌' : '⏳';
    actionLines.push(`${ciEmoji} CI: ${report.actions.ciStatus}`);
  }
  
  if (report.actions.issuesCreated && report.actions.issuesCreated > 0) {
    actionLines.push(`📋 ${report.actions.issuesCreated} issue(s) criada(s)`);
  }

  return {
    blocks: [
      {
        type: 'header',
        text: {
          type: 'plain_text',
          text: '📊 Keelo - Relatório de Ações',
          emoji: true,
        },
      },
      {
        type: 'section',
        fields: [
          {
            type: 'mrkdwn',
            text: `*Repositório:*\n${report.repository}`,
          },
          {
            type: 'mrkdwn',
            text: `*PR:*\n<${report.prUrl}|#${report.prNumber}>`,
          },
        ],
      },
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `*${report.prTitle}*`,
        },
      },
      {
        type: 'divider',
      },
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: '*🤖 Ações Executadas:*\n' + actionLines.join('\n'),
        },
      },
      {
        type: 'section',
        fields: [
          {
            type: 'mrkdwn',
            text: `*Risco Geral:*\n${riskEmoji[report.overallRisk]} ${report.overallRisk.toUpperCase()}`,
          },
          {
            type: 'mrkdwn',
            text: `*Cenários:*\n📋 ${report.scenariosCount}`,
          },
          {
            type: 'mrkdwn',
            text: `*Riscos:*\n⚠️ ${report.actions.risksIdentified}`,
          },
          {
            type: 'mrkdwn',
            text: `*Gaps:*\n❓ ${report.actions.gapsFound}`,
          },
        ],
      },
    ],
    attachments: [
      {
        color: riskColor[report.overallRisk],
        blocks: [
          {
            type: 'context',
            elements: [
              {
                type: 'mrkdwn',
                text: report.dashboardUrl 
                  ? `<${report.dashboardUrl}|📊 Ver no Dashboard>`
                  : `ID: ${report.analysisId?.substring(0, 8) || 'N/A'}`,
              },
            ],
          },
        ],
      },
    ],
  };
}

export async function sendActionReport(
  webhookUrl: string,
  report: KeeloActionReport
): Promise<boolean> {
  if (!webhookUrl) {
    logger.debug('No Slack webhook URL configured');
    return false;
  }

  const message = buildActionReportNotification(report);
  return sendSlackNotification(webhookUrl, message);
}

// =============================================================================
// QA Health Report (Daily/Weekly summary)
// =============================================================================

export interface QAHealthReport {
  period: 'daily' | 'weekly';
  dateRange: {
    start: string;
    end: string;
  };
  
  metrics: {
    totalPRsAnalyzed: number;
    testsGenerated: number;
    testPRsCreated: number;
    testPRsMerged: number;
    ciPassRate: number; // percentage
    
    risksIdentified: {
      critical: number;
      high: number;
      medium: number;
      low: number;
    };
    
    coverageMetrics?: {
      average: number;
      improved: number;
      decreased: number;
    };
    
    hotSpots: Array<{
      area: string;
      riskCount: number;
    }>;
  };
  
  dashboardUrl: string;
}

export function buildQAHealthReportNotification(report: QAHealthReport): SlackMessage {
  const periodLabel = report.period === 'daily' ? 'Diário' : 'Semanal';
  const totalRisks = report.metrics.risksIdentified.critical + 
                     report.metrics.risksIdentified.high + 
                     report.metrics.risksIdentified.medium + 
                     report.metrics.risksIdentified.low;

  // Determine overall health
  let healthEmoji = '🟢';
  let healthText = 'Saudável';
  if (report.metrics.risksIdentified.critical > 0) {
    healthEmoji = '🔴';
    healthText = 'Atenção Crítica';
  } else if (report.metrics.risksIdentified.high > 2) {
    healthEmoji = '🟠';
    healthText = 'Requer Atenção';
  } else if (report.metrics.ciPassRate < 80) {
    healthEmoji = '🟡';
    healthText = 'CI Instável';
  }

  // Build hotspots section
  const hotspotsText = report.metrics.hotSpots.length > 0
    ? report.metrics.hotSpots.slice(0, 5).map(h => `• ${h.area}: ${h.riskCount} riscos`).join('\n')
    : 'Nenhum hot spot identificado';

  return {
    blocks: [
      {
        type: 'header',
        text: {
          type: 'plain_text',
          text: `📈 Keelo - Relatório ${periodLabel} de QA`,
          emoji: true,
        },
      },
      {
        type: 'context',
        elements: [
          {
            type: 'mrkdwn',
            text: `Período: ${report.dateRange.start} a ${report.dateRange.end}`,
          },
        ],
      },
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `*Status Geral:* ${healthEmoji} ${healthText}`,
        },
      },
      {
        type: 'divider',
      },
      {
        type: 'section',
        fields: [
          {
            type: 'mrkdwn',
            text: `*PRs Analisados:*\n📊 ${report.metrics.totalPRsAnalyzed}`,
          },
          {
            type: 'mrkdwn',
            text: `*Testes Gerados:*\n🧪 ${report.metrics.testsGenerated}`,
          },
          {
            type: 'mrkdwn',
            text: `*PRs de Teste:*\n📝 ${report.metrics.testPRsCreated} criados, ${report.metrics.testPRsMerged} merged`,
          },
          {
            type: 'mrkdwn',
            text: `*Taxa CI:*\n${report.metrics.ciPassRate >= 90 ? '✅' : report.metrics.ciPassRate >= 70 ? '🟡' : '❌'} ${report.metrics.ciPassRate.toFixed(0)}%`,
          },
        ],
      },
      {
        type: 'section',
        fields: [
          {
            type: 'mrkdwn',
            text: `*Riscos Identificados:*\n🔴 ${report.metrics.risksIdentified.critical} críticos\n🟠 ${report.metrics.risksIdentified.high} altos\n🟡 ${report.metrics.risksIdentified.medium} médios\n🟢 ${report.metrics.risksIdentified.low} baixos`,
          },
          {
            type: 'mrkdwn',
            text: `*Hot Spots:*\n${hotspotsText}`,
          },
        ],
      },
      {
        type: 'actions',
        elements: [
          {
            type: 'button',
            text: {
              type: 'plain_text',
              text: '📊 Ver Dashboard Completo',
              emoji: true,
            },
            url: report.dashboardUrl,
            style: 'primary',
          },
        ],
      },
    ],
  };
}

export async function sendQAHealthReport(
  webhookUrl: string,
  report: QAHealthReport
): Promise<boolean> {
  if (!webhookUrl) {
    logger.debug('No Slack webhook URL configured');
    return false;
  }

  const message = buildQAHealthReportNotification(report);
  return sendSlackNotification(webhookUrl, message);
}

// =============================================================================
// Weekly Quality Report (V1)
// =============================================================================

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
}

export function buildWeeklyQualityReportNotification(report: WeeklyQualityReport): SlackMessage {
  const highlights = report.highlights.length > 0
    ? report.highlights.slice(0, 2).map((item) => `• ${item}`).join('\n')
    : '• Sem destaque relevante nesta semana';

  return {
    text: `Keelo - Qualidade da semana (${report.dateRange.start} a ${report.dateRange.end})`,
    blocks: [
      {
        type: 'header',
        text: {
          type: 'plain_text',
          text: 'Qualidade essa semana',
          emoji: true,
        },
      },
      {
        type: 'context',
        elements: [
          { type: 'mrkdwn', text: `Período: ${report.dateRange.start} a ${report.dateRange.end}` },
        ],
      },
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: [
            `*PRs analisados pelo Keelo:* ${report.prsAnalyzed}`,
            `*Testes gerados:* ${report.testsGenerated}`,
            `*Taxa de aceitação dos testes:* ${report.testAcceptanceRate}%`,
            `*Bugs pegos antes de produção:* ${report.bugsCaughtBeforeProduction}`,
            `*Bugs escapados para produção:* ${report.bugsEscapedToProduction}`,
            `*Fluxos críticos com cobertura:* ${report.criticalFlowCoverage.covered}/${report.criticalFlowCoverage.total}`,
          ].join('\n'),
        },
      },
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `*Destaques:*\n${highlights}`,
        },
      },
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `*Ação:*\n${report.nextWeekAction}`,
        },
      },
    ],
  };
}

export async function sendWeeklyQualityReport(
  webhookUrl: string,
  report: WeeklyQualityReport
): Promise<boolean> {
  if (!webhookUrl) {
    logger.debug('No Slack webhook URL configured');
    return false;
  }
  const message = buildWeeklyQualityReportNotification(report);
  return sendSlackNotification(webhookUrl, message);
}

// =============================================================================
// CI Status Update
// =============================================================================

export interface CIStatusUpdate {
  repository: string;
  testPRNumber: number;
  testPRUrl: string;
  originalPRNumber: number;
  originalPRUrl: string;
  status: 'success' | 'failure';
  failedChecks?: string[];
  passedChecks?: string[];
}

export function buildCIStatusNotification(update: CIStatusUpdate): SlackMessage {
  const isSuccess = update.status === 'success';
  
  const blocks: SlackBlock[] = [
    {
      type: 'header',
      text: {
        type: 'plain_text',
        text: isSuccess 
          ? '✅ Keelo - Testes Passaram!' 
          : '❌ Keelo - Testes Falharam',
        emoji: true,
      },
    },
    {
      type: 'section',
      fields: [
        {
          type: 'mrkdwn',
          text: `*Repositório:*\n${update.repository}`,
        },
        {
          type: 'mrkdwn',
          text: `*PR de Testes:*\n<${update.testPRUrl}|#${update.testPRNumber}>`,
        },
      ],
    },
    {
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: `Referente ao <${update.originalPRUrl}|PR #${update.originalPRNumber}>`,
      },
    },
  ];

  if (isSuccess) {
    blocks.push({
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: '🎉 *Todos os testes gerados automaticamente passaram!*\n\nO PR de testes está pronto para review e merge.',
      },
    });
  } else {
    blocks.push({
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: `⚠️ *${update.failedChecks?.length || 0} check(s) falharam:*\n${update.failedChecks?.map(c => `• ${c}`).join('\n') || 'Detalhes indisponíveis'}`,
      },
    });
    blocks.push({
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: '💡 *Próximos passos:*\n1. Revise os logs do CI\n2. Ajuste os testes se necessário\n3. Os testes podem precisar de contexto adicional do projeto',
      },
    });
  }

  blocks.push({
    type: 'actions',
    elements: [
      {
        type: 'button',
        text: {
          type: 'plain_text',
          text: isSuccess ? '📝 Revisar PR de Testes' : '🔍 Ver Logs do CI',
          emoji: true,
        },
        url: update.testPRUrl,
        style: isSuccess ? 'primary' : undefined,
      },
    ],
  });

  return {
    blocks,
    attachments: [
      {
        color: isSuccess ? '#16a34a' : '#dc2626',
        blocks: [],
      },
    ],
  };
}

export async function sendCIStatusUpdate(
  webhookUrl: string,
  update: CIStatusUpdate
): Promise<boolean> {
  if (!webhookUrl) {
    logger.debug('No Slack webhook URL configured');
    return false;
  }

  const message = buildCIStatusNotification(update);
  return sendSlackNotification(webhookUrl, message);
}

// =============================================================================
// Product Impact Notification (Pilar 3)
// =============================================================================

export interface ProductImpactNotificationData {
  analysisId: string;
  prNumber?: number;
  repository?: string;
  productHealthScore: number;
  productHealthStatus: 'healthy' | 'attention' | 'degraded' | 'critical';
  mergeDecision: string;
  mergeEmoji: string;
  executiveSummary: string;
  uxIssuesCount: number;
  criticalRisks: number;
  topRecommendations: string[];
  dashboardUrl?: string;
}

export function buildProductImpactNotification(data: ProductImpactNotificationData): SlackMessage {
  const healthEmoji: Record<string, string> = {
    healthy: '💚',
    attention: '💛',
    degraded: '🧡',
    critical: '❤️',
  };

  const blocks: SlackBlock[] = [
    {
      type: 'header',
      text: {
        type: 'plain_text',
        text: `${data.mergeEmoji} Keelo - Impacto no Produto`,
        emoji: true,
      },
    },
  ];

  // PR info
  if (data.repository || data.prNumber) {
    blocks.push({
      type: 'section',
      fields: [
        ...(data.repository ? [{ type: 'mrkdwn', text: `*Repositório:*\n${data.repository}` }] : []),
        ...(data.prNumber ? [{ type: 'mrkdwn', text: `*PR:*\n#${data.prNumber}` }] : []),
      ],
    });
  }

  // Decision + Health
  blocks.push({
    type: 'section',
    fields: [
      { type: 'mrkdwn', text: `*Decisão:*\n${data.mergeEmoji} ${data.mergeDecision}` },
      { type: 'mrkdwn', text: `*Saúde do Produto:*\n${healthEmoji[data.productHealthStatus] || '⚪'} ${data.productHealthScore}/100` },
    ],
  });

  // Executive summary
  blocks.push({
    type: 'section',
    text: {
      type: 'mrkdwn',
      text: `*📋 Resumo para PM/CTO:*\n${data.executiveSummary}`,
    },
  });

  // Stats
  blocks.push({
    type: 'section',
    fields: [
      { type: 'mrkdwn', text: `*🎨 Issues de UX:*\n${data.uxIssuesCount}` },
      { type: 'mrkdwn', text: `*🔴 Riscos Críticos:*\n${data.criticalRisks}` },
    ],
  });

  // Recommendations
  if (data.topRecommendations.length > 0) {
    blocks.push({
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: `*✅ Recomendações:*\n${data.topRecommendations.map(r => `• ${r}`).join('\n')}`,
      },
    });
  }

  // Dashboard link
  if (data.dashboardUrl) {
    blocks.push({
      type: 'actions',
      elements: [
        {
          type: 'button',
          text: {
            type: 'plain_text',
            text: '📊 Ver Relatório Completo',
            emoji: true,
          },
          url: data.dashboardUrl,
        },
      ],
    });
  }

  return {
    text: `${data.mergeEmoji} Keelo - Impacto no Produto | Saúde: ${data.productHealthScore}/100`,
    blocks,
  };
}

export async function sendProductImpactNotification(
  webhookUrl: string,
  data: ProductImpactNotificationData
): Promise<boolean> {
  if (!webhookUrl) {
    logger.debug('No Slack webhook URL configured');
    return false;
  }

  const message = buildProductImpactNotification(data);
  return sendSlackNotification(webhookUrl, message);
}
