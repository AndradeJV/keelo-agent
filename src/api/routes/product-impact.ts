import { Router, Request, Response } from 'express';
import { logger, getSlackConfig } from '../../config/index.js';
import { isDatabaseEnabled, queryOne, queryAll } from '../../database/connection.js';
import { 
  generateProductImpactReport, 
  formatProductImpactMarkdown,
  buildProductImpactSlackMessage,
  type ProductImpactReport,
} from '../../core/product-impact.js';
import { sendSlackNotification } from '../../integrations/slack/index.js';
import type { AnalysisResult } from '../../core/types.js';

const router = Router();

function isValidAnalysisResult(data: unknown): data is AnalysisResult {
  if (!data || typeof data !== 'object') return false;
  const candidate = data as Partial<AnalysisResult>;
  return (
    Array.isArray(candidate.risks) &&
    Array.isArray(candidate.gaps) &&
    Array.isArray(candidate.scenarios) &&
    typeof candidate.overallRisk === 'string' &&
    typeof candidate.summary === 'object' &&
    candidate.summary !== null
  );
}

// =============================================================================
// Middleware
// =============================================================================

function requireDatabase(_req: Request, res: Response, next: Function) {
  if (!isDatabaseEnabled()) {
    return res.status(503).json({
      error: 'Database not configured',
      message: 'Product impact reports require database to be enabled',
    });
  }
  next();
}

// =============================================================================
// Routes
// =============================================================================

/**
 * GET /product-impact/:analysisId
 * 
 * Generate product impact report for a specific analysis
 */
router.get('/:analysisId([0-9a-fA-F-]{36})', requireDatabase, async (req: Request, res: Response) => {
  try {
    const { analysisId } = req.params;
    const format = (req.query.format as string) || 'json';

    // Fetch the analysis from database
    const analysis = await queryOne(
      `SELECT 
        a.id, a.pr_number, a.pr_title, a.overall_risk, 
        a.result_data, a.summary_title, a.summary_description,
        r.owner, r.name as repo_name
      FROM analyses a
      LEFT JOIN repositories r ON a.repository_id = r.id
      WHERE a.id = $1`,
      [analysisId]
    );

    if (!analysis) {
      return res.status(404).json({ error: 'Análise não encontrada' });
    }

    // Parse the stored analysis result
    let analysisResult: AnalysisResult;
    try {
      const parsed = typeof analysis.result_data === 'string'
        ? JSON.parse(analysis.result_data)
        : analysis.result_data;
      if (!isValidAnalysisResult(parsed)) {
        return res.status(422).json({
          error: 'Dados insuficientes para Product Impact',
          message: 'Esta análise foi salva sem estrutura completa para o relatório de impacto.',
        });
      }
      analysisResult = parsed;
    } catch {
      return res.status(500).json({ 
        error: 'Dados da análise corrompidos',
        message: 'Não foi possível processar os dados da análise armazenada.',
      });
    }

    // Generate the product impact report
    const repository = analysis.owner && analysis.repo_name 
      ? `${analysis.owner}/${analysis.repo_name}` 
      : undefined;

    const report = generateProductImpactReport(analysisResult, {
      analysisId,
      prNumber: analysis.pr_number,
      repository,
    });

    // Return based on format
    if (format === 'markdown') {
      const markdown = formatProductImpactMarkdown(report);
      res.setHeader('Content-Type', 'text/markdown; charset=utf-8');
      res.setHeader('Content-Disposition', `inline; filename="product-impact-${analysisId}.md"`);
      return res.send(markdown);
    }

    res.json({
      success: true,
      data: report,
    });
  } catch (error) {
    logger.error({ error }, 'Failed to generate product impact report');
    res.status(500).json({
      error: 'Falha ao gerar relatório de impacto no produto',
      details: error instanceof Error ? error.message : 'Erro desconhecido',
    });
  }
});

/**
 * POST /product-impact/:analysisId/slack
 * 
 * Send product impact report to Slack
 */
router.post('/:analysisId([0-9a-fA-F-]{36})/slack', requireDatabase, async (req: Request, res: Response) => {
  try {
    const { analysisId } = req.params;

    const slackConfig = getSlackConfig();
    if (!slackConfig.enabled || !slackConfig.webhookUrl) {
      return res.status(400).json({
        error: 'Slack não configurado',
        message: 'Configure SLACK_WEBHOOK_URL para enviar relatórios.',
      });
    }

    // Fetch the analysis from database
    const analysis = await queryOne(
      `SELECT 
        a.id, a.pr_number, a.pr_title, a.overall_risk, 
        a.result_data,
        r.owner, r.name as repo_name
      FROM analyses a
      LEFT JOIN repositories r ON a.repository_id = r.id
      WHERE a.id = $1`,
      [analysisId]
    );

    if (!analysis) {
      return res.status(404).json({ error: 'Análise não encontrada' });
    }

    let analysisResult: AnalysisResult;
    try {
      const parsed = typeof analysis.result_data === 'string'
        ? JSON.parse(analysis.result_data)
        : analysis.result_data;
      if (!isValidAnalysisResult(parsed)) {
        return res.status(422).json({
          error: 'Dados insuficientes para Product Impact',
          message: 'Esta análise foi salva sem estrutura completa para o relatório de impacto.',
        });
      }
      analysisResult = parsed;
    } catch {
      return res.status(500).json({ error: 'Dados da análise corrompidos' });
    }

    const repository = analysis.owner && analysis.repo_name 
      ? `${analysis.owner}/${analysis.repo_name}` 
      : undefined;

    const report = generateProductImpactReport(analysisResult, {
      analysisId,
      prNumber: analysis.pr_number,
      repository,
    });

    const slackMessage = buildProductImpactSlackMessage(report);
    const sent = await sendSlackNotification(slackConfig.webhookUrl, slackMessage);

    if (sent) {
      res.json({
        success: true,
        message: 'Relatório de impacto enviado para o Slack com sucesso.',
      });
    } else {
      res.status(500).json({
        error: 'Falha ao enviar relatório para o Slack',
      });
    }
  } catch (error) {
    logger.error({ error }, 'Failed to send product impact report to Slack');
    res.status(500).json({
      error: 'Falha ao enviar relatório',
      details: error instanceof Error ? error.message : 'Erro desconhecido',
    });
  }
});

/**
 * GET /product-impact/insights/aggregate
 * 
 * Get aggregated product insights across recent analyses
 * For PM/CTO dashboard overview
 */
router.get('/insights/aggregate', requireDatabase, async (req: Request, res: Response) => {
  try {
    const days = parseInt(req.query.days as string) || 30;

    // Get recent analyses
    const analyses = await queryAll(
      `SELECT 
        a.id, a.pr_number, a.pr_title, a.overall_risk,
        a.scenarios_count, a.risks_count, a.gaps_count,
        a.result_data, a.completed_at,
        r.owner, r.name as repo_name
      FROM analyses a
      LEFT JOIN repositories r ON a.repository_id = r.id
      WHERE a.status = 'completed'
        AND a.completed_at >= NOW() - INTERVAL '${days} days'
      ORDER BY a.completed_at DESC
      LIMIT 50`
    );

    // Aggregate metrics
    let totalRisks = 0;
    let criticalRisks = 0;
    let highRisks = 0;
    let totalScenarios = 0;
    let totalGaps = 0;
    let blockedPRs = 0;
    let attentionPRs = 0;
    let mergeOkPRs = 0;
    const riskAreas: Record<string, number> = {};
    const recentImpacts: Array<{
      prNumber?: number;
      repository?: string;
      riskLevel: string;
      title: string;
      date: string;
    }> = [];

    for (const row of analyses) {
      totalRisks += Number(row.risks_count || 0);
      totalScenarios += Number(row.scenarios_count || 0);
      totalGaps += Number(row.gaps_count || 0);

      const risk = row.overall_risk || 'medium';
      if (risk === 'critical') {
        criticalRisks++;
        blockedPRs++;
      } else if (risk === 'high') {
        highRisks++;
        attentionPRs++;
      } else {
        mergeOkPRs++;
      }

      // Track risk areas from result_data
      try {
        const resultData = typeof row.result_data === 'string' 
          ? JSON.parse(row.result_data) 
          : row.result_data;
        
        if (resultData?.risks) {
          for (const r of resultData.risks) {
            const area = r.area || 'Desconhecida';
            riskAreas[area] = (riskAreas[area] || 0) + 1;
          }
        }
      } catch {
        // Ignore parsing errors
      }

      // Add to recent impacts
      if (risk === 'critical' || risk === 'high') {
        const repository = row.owner && row.repo_name 
          ? `${row.owner}/${row.repo_name}` 
          : undefined;

        recentImpacts.push({
          prNumber: row.pr_number,
          repository,
          riskLevel: risk,
          title: row.pr_title || 'Análise de requisitos',
          date: row.completed_at,
        });
      }
    }

    // Top risk areas
    const topRiskAreas = Object.entries(riskAreas)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 10)
      .map(([area, count]) => ({ area, count }));

    // Overall product health trend
    let healthTrend = 'estável';
    if (criticalRisks > analyses.length * 0.3) healthTrend = 'degradando';
    else if (criticalRisks === 0 && highRisks < analyses.length * 0.2) healthTrend = 'melhorando';

    res.json({
      success: true,
      data: {
        period: `${days} dias`,
        totalAnalyses: analyses.length,
        summary: {
          totalRisks,
          criticalRisks,
          highRisks,
          totalScenarios,
          totalGaps,
        },
        mergeDecisions: {
          blocked: blockedPRs,
          attention: attentionPRs,
          approved: mergeOkPRs,
        },
        topRiskAreas,
        healthTrend,
        recentImpacts: recentImpacts.slice(0, 10),
      },
    });
  } catch (error) {
    logger.error({ error }, 'Failed to get aggregated product insights');
    res.status(500).json({
      error: 'Falha ao buscar insights de produto',
      details: error instanceof Error ? error.message : 'Erro desconhecido',
    });
  }
});

export default router;

