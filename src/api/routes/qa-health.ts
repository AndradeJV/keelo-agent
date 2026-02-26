import { Router, Request, Response } from 'express';
import { logger, getSlackConfig } from '../../config/index.js';
import { isDatabaseEnabled, queryOne, queryAll } from '../../database/connection.js';
import {
  getQAHealthMetrics,
  getAreaCoverage,
  getFlakyTests,
  getTestEffectiveness,
} from '../../database/index.js';
import { sendQAHealthReport, type QAHealthReport } from '../../integrations/slack/index.js';
import { generateWeeklyQualityReport, runWeeklyQualityReport } from '../../core/weekly-quality-report.js';
import { getAudienceMetrics, type AudienceRole } from '../../core/audience-metrics.js';

const router = Router();

// =============================================================================
// Middleware
// =============================================================================

function requireDatabase(req: Request, res: Response, next: Function) {
  if (!isDatabaseEnabled()) {
    return res.status(503).json({
      error: 'Database not configured',
      message: 'QA health metrics require database to be enabled',
    });
  }
  next();
}

// =============================================================================
// Routes
// =============================================================================

/**
 * GET /qa-health
 * 
 * Get comprehensive QA health metrics
 */
router.get('/', requireDatabase, async (req: Request, res: Response) => {
  try {
    const period = (req.query.period as 'daily' | 'weekly' | 'monthly') || 'weekly';
    const repositoryId = req.query.repository_id as string | undefined;

    const metrics = await getQAHealthMetrics(period, repositoryId);

    if (!metrics) {
      return res.status(500).json({
        error: 'Failed to fetch QA health metrics',
      });
    }

    res.json({
      success: true,
      data: metrics,
    });
  } catch (error) {
    logger.error({ error }, 'Failed to get QA health metrics');
    res.status(500).json({
      error: 'Falha ao buscar métricas de saúde de QA',
      details: error instanceof Error ? error.message : 'Erro desconhecido',
    });
  }
});

/**
 * GET /qa-health/coverage
 * 
 * Get coverage by area
 */
router.get('/coverage', requireDatabase, async (_req: Request, res: Response) => {
  try {
    const coverage = await getAreaCoverage();

    res.json({
      success: true,
      data: coverage,
    });
  } catch (error) {
    logger.error({ error }, 'Failed to get area coverage');
    res.status(500).json({
      error: 'Falha ao buscar cobertura por área',
      details: error instanceof Error ? error.message : 'Erro desconhecido',
    });
  }
});

/**
 * GET /qa-health/flaky
 * 
 * Get flaky tests
 */
router.get('/flaky', requireDatabase, async (_req: Request, res: Response) => {
  try {
    const flakyTests = await getFlakyTests();

    res.json({
      success: true,
      data: flakyTests,
    });
  } catch (error) {
    logger.error({ error }, 'Failed to get flaky tests');
    res.status(500).json({
      error: 'Falha ao buscar testes flaky',
      details: error instanceof Error ? error.message : 'Erro desconhecido',
    });
  }
});

/**
 * GET /qa-health/effectiveness
 * 
 * Get test effectiveness metrics
 */
router.get('/effectiveness', requireDatabase, async (_req: Request, res: Response) => {
  try {
    const effectiveness = await getTestEffectiveness();

    res.json({
      success: true,
      data: effectiveness,
    });
  } catch (error) {
    logger.error({ error }, 'Failed to get test effectiveness');
    res.status(500).json({
      error: 'Falha ao buscar efetividade dos testes',
      details: error instanceof Error ? error.message : 'Erro desconhecido',
    });
  }
});

/**
 * POST /qa-health/report/slack
 * 
 * Send QA health report to Slack
 */
router.post('/report/slack', requireDatabase, async (req: Request, res: Response) => {
  try {
    const period = (req.body.period as 'daily' | 'weekly') || 'weekly';
    
    const slackConfig = getSlackConfig();
    if (!slackConfig.enabled || !slackConfig.webhookUrl) {
      return res.status(400).json({
        error: 'Slack não configurado',
        message: 'Configure SLACK_WEBHOOK_URL para enviar relatórios',
      });
    }

    const metrics = await getQAHealthMetrics(period);
    if (!metrics) {
      return res.status(500).json({
        error: 'Failed to fetch metrics for report',
      });
    }

    // Build report for Slack
    const report: QAHealthReport = {
      period,
      dateRange: metrics.dateRange,
      metrics: {
        totalPRsAnalyzed: metrics.totalPRsAnalyzed,
        testsGenerated: metrics.testsGenerated,
        testPRsCreated: metrics.testPRsCreated,
        testPRsMerged: 0, // TODO: Track this
        ciPassRate: 85, // TODO: Calculate from actual data
        risksIdentified: metrics.risks,
        coverageMetrics: metrics.coverage.average > 0 ? {
          average: metrics.coverage.average,
          improved: metrics.coverage.improved,
          decreased: metrics.coverage.decreased,
        } : undefined,
        hotSpots: metrics.hotSpots.slice(0, 5).map(h => ({
          area: h.area,
          riskCount: h.riskCount,
        })),
      },
      dashboardUrl: `${process.env.BASE_URL || 'http://localhost:3000'}/qa-health`,
    };

    const sent = await sendQAHealthReport(slackConfig.webhookUrl, report);

    if (sent) {
      res.json({
        success: true,
        message: 'Relatório enviado para o Slack com sucesso',
      });
    } else {
      res.status(500).json({
        error: 'Falha ao enviar relatório para o Slack',
      });
    }
  } catch (error) {
    logger.error({ error }, 'Failed to send Slack report');
    res.status(500).json({
      error: 'Falha ao enviar relatório',
      details: error instanceof Error ? error.message : 'Erro desconhecido',
    });
  }
});

/**
 * POST /qa-health/report/weekly
 *
 * Send the V1 weekly quality report template to Slack.
 */
router.post('/report/weekly', requireDatabase, async (req: Request, res: Response) => {
  try {
    const force = Boolean(req.body?.force);
    const sent = await runWeeklyQualityReport(force);
    if (!sent) {
      return res.status(400).json({
        success: false,
        message: 'Não foi possível enviar relatório semanal (verifique Jira/Slack).',
      });
    }

    res.json({
      success: true,
      message: 'Relatório semanal enviado com sucesso',
    });
  } catch (error) {
    logger.error({ error }, 'Failed to send weekly report');
    res.status(500).json({
      error: 'Falha ao enviar relatório semanal',
      details: error instanceof Error ? error.message : 'Erro desconhecido',
    });
  }
});

/**
 * GET /qa-health/report/weekly/preview
 *
 * Build but do not send weekly report payload.
 */
router.get('/report/weekly/preview', requireDatabase, async (_req: Request, res: Response) => {
  try {
    const report = await generateWeeklyQualityReport();
    res.json({
      success: true,
      data: report,
    });
  } catch (error) {
    logger.error({ error }, 'Failed to preview weekly report');
    res.status(500).json({
      error: 'Falha ao gerar preview do relatório semanal',
      details: error instanceof Error ? error.message : 'Erro desconhecido',
    });
  }
});

/**
 * GET /qa-health/summary
 * 
 * Get a quick summary for dashboard cards
 */
router.get('/summary', requireDatabase, async (_req: Request, res: Response) => {
  try {
    const metrics = await getQAHealthMetrics('weekly');
    const effectiveness = await getTestEffectiveness();

    if (!metrics) {
      return res.status(500).json({
        error: 'Failed to fetch summary',
      });
    }

    // Calculate health score (0-100)
    let healthScore = 100;
    
    // Deduct for critical risks
    healthScore -= metrics.risks.critical * 15;
    healthScore -= metrics.risks.high * 5;
    
    // Deduct for unresolved gaps
    healthScore -= Math.min(20, metrics.gaps.pending * 2);
    
    // Ensure score is within bounds
    healthScore = Math.max(0, Math.min(100, healthScore));

    // Determine health status
    let healthStatus: 'excellent' | 'good' | 'attention' | 'critical' = 'excellent';
    if (healthScore < 50) healthStatus = 'critical';
    else if (healthScore < 70) healthStatus = 'attention';
    else if (healthScore < 90) healthStatus = 'good';

    res.json({
      success: true,
      data: {
        healthScore,
        healthStatus,
        totalAnalyses: metrics.totalPRsAnalyzed + metrics.requirementsAnalyzed,
        testsGenerated: metrics.testsGenerated,
        risksIdentified: metrics.risks.total,
        criticalRisks: metrics.risks.critical,
        gapsFound: metrics.gaps.total,
        scenariosCreated: metrics.scenarios.total,
        hotSpotsCount: metrics.hotSpots.length,
        prsWithoutTestsCount: metrics.prsWithoutTests.length,
        effectiveness,
        period: metrics.dateRange,
      },
    });
  } catch (error) {
    logger.error({ error }, 'Failed to get summary');
    res.status(500).json({
      error: 'Falha ao buscar resumo',
      details: error instanceof Error ? error.message : 'Erro desconhecido',
    });
  }
});

/**
 * GET /qa-health/audience?role=cto|pm|qa&period=daily|weekly|monthly
 *
 * Role-based reliable metric views for executives and QA leadership.
 */
router.get('/audience', requireDatabase, async (req: Request, res: Response) => {
  try {
    const role = ((req.query.role as string) || 'qa') as AudienceRole;
    const period = ((req.query.period as string) || 'weekly') as 'daily' | 'weekly' | 'monthly';
    if (!['cto', 'pm', 'qa'].includes(role)) {
      return res.status(400).json({
        error: 'Role inválida. Use cto, pm ou qa.',
      });
    }

    const data = await getAudienceMetrics(role, period);
    res.json({ success: true, data });
  } catch (error) {
    logger.error({ error }, 'Failed to get audience metrics');
    res.status(500).json({
      error: 'Falha ao buscar métricas por perfil',
      details: error instanceof Error ? error.message : 'Erro desconhecido',
    });
  }
});

// =============================================================================
// Autonomy Metrics
// =============================================================================

/**
 * GET /qa-health/autonomy
 * 
 * Get autonomy metrics (auto-fix)
 */
router.get('/autonomy', requireDatabase, async (_req: Request, res: Response) => {
  try {
    // Get auto-fix stats
    const autoFixStats = await queryOne(
      `SELECT 
        COUNT(*) as total_attempts,
        SUM(CASE WHEN success THEN 1 ELSE 0 END) as successful_fixes,
        COUNT(DISTINCT test_pr_number) as prs_fixed
      FROM auto_fix_attempts
      WHERE created_at >= NOW() - INTERVAL '30 days'`
    );

    // Calculate success rate
    const totalAttempts = Number(autoFixStats?.total_attempts || 0);
    const successfulFixes = Number(autoFixStats?.successful_fixes || 0);
    const autoFixSuccess = totalAttempts > 0
      ? Math.round((successfulFixes / totalAttempts) * 100)
      : 0;

    res.json({
      success: true,
      data: {
        autoFix: {
          enabled: true,
          totalAttempts,
          successfulFixes,
          successRate: autoFixSuccess,
          prsFixed: Number(autoFixStats?.prs_fixed || 0),
        },
        period: '30 dias',
      },
    });
  } catch (error) {
    logger.error({ error }, 'Failed to get autonomy metrics');
    res.status(500).json({
      error: 'Falha ao buscar métricas de autonomia',
      details: error instanceof Error ? error.message : 'Erro desconhecido',
    });
  }
});

/**
 * GET /qa-health/roi
 * 
 * Get ROI (time saved) estimates
 */
router.get('/roi', requireDatabase, async (_req: Request, res: Response) => {
  try {
    // Estimate time saved based on activities
    const stats = await queryOne(
      `SELECT 
        COUNT(DISTINCT a.id) as analyses_count,
        (SELECT SUM(CASE WHEN success THEN 1 ELSE 0 END) FROM auto_fix_attempts WHERE created_at >= NOW() - INTERVAL '30 days') as fixes_count
      FROM analyses a
      WHERE a.created_at >= NOW() - INTERVAL '30 days'`
    );

    // Time estimates (in minutes)
    const TIME_PER_ANALYSIS = 30; // Manual PR review
    const TIME_PER_FIX = 45; // Debugging and fixing test

    const analysesCount = Number(stats?.analyses_count || 0);
    const fixesCount = Number(stats?.fixes_count || 0);

    const timeSavedMinutes = 
      (analysesCount * TIME_PER_ANALYSIS) +
      (fixesCount * TIME_PER_FIX);

    const timeSavedHours = Math.round(timeSavedMinutes / 60);
    const costSaved = timeSavedHours * 50; // Assuming $50/hour

    res.json({
      success: true,
      data: {
        period: '30 dias',
        activities: {
          prAnalyses: analysesCount,
          autoFixes: fixesCount,
        },
        timeSaved: {
          minutes: timeSavedMinutes,
          hours: timeSavedHours,
          formatted: `${Math.floor(timeSavedHours / 8)} dias de trabalho`,
        },
        estimatedCostSaved: {
          value: costSaved,
          formatted: `$${costSaved.toLocaleString()}`,
          note: 'Baseado em $50/hora',
        },
      },
    });
  } catch (error) {
    logger.error({ error }, 'Failed to get ROI metrics');
    res.status(500).json({
      error: 'Falha ao calcular ROI',
      details: error instanceof Error ? error.message : 'Erro desconhecido',
    });
  }
});

export default router;

