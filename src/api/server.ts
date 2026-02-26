import express from 'express';
import { createServer } from 'http';
import { config, logger, getLanguage, keeloConfig, getSlackConfig, getTriggerMode } from '../config/index.js';
import { initWebSocket, getConnectedClients, emitAnalysisNew, emitAnalysisUpdate, emitNotification } from './websocket.js';
import { verifyWebhookSignature } from '../integrations/github/index.js';
import { handlePullRequestEvent, handleCommentCommand, handleSilentPRAnalysis } from '../core/index.js';
import { 
  analyzeRequirements, 
  validateRequirementsInput,
  formatRequirementsAnalysis,
  type RequirementsInput,
} from '../core/requirements-analyzer.js';
import { parsePDFFromBase64 } from '../core/pdf-parser.js';
import { 
  initDatabase, 
  isDatabaseEnabled, 
  checkDatabaseHealth,
  createRequirementsAnalysis,
  createPendingRequirementsAnalysis,
  markAnalysisProcessing,
  completeRequirementsAnalysis,
  markAnalysisFailed,
} from '../database/index.js';
import { notifyRequirementsAnalysisComplete } from '../integrations/slack/index.js';
import historyRoutes from './routes/history.js';
import authRoutes from './routes/auth.js';
import organizationsRoutes from './routes/organizations.js';
import qaHealthRoutes from './routes/qa-health.js';
import settingsRoutes from './routes/settings.js';
import productImpactRoutes from './routes/product-impact.js';
import { requireAuth, optionalAuth } from './middleware/auth.js';
import type { WebhookPayload, IssueCommentPayload } from '../core/types.js';
import { enforceHybridModeAtStartup, getPRTriggerDecision } from '../core/trigger-mode.js';
import { startWeeklyReportScheduler } from '../core/weekly-report-scheduler.js';

// =============================================================================
// Express App Setup
// =============================================================================

const app = express();

// CORS - allow frontend (Vercel) to call backend (Render)
app.use((_req, res, next) => {
  const origin = _req.headers.origin;
  const allowedOrigin = process.env.CORS_ORIGIN || '*';
  
  res.setHeader('Access-Control-Allow-Origin', allowedOrigin === '*' ? '*' : (origin || '*'));
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  
  if (_req.method === 'OPTIONS') {
    return res.sendStatus(204);
  }
  next();
});

// Increase limit for image uploads
app.use(express.json({ 
  limit: '50mb',
  verify: (req, _res, buf) => {
    (req as express.Request & { rawBody: string }).rawBody = buf.toString();
  },
}));

// =============================================================================
// Routes - Health
// =============================================================================

app.get('/health', async (_req, res) => {
  const dbHealthy = await checkDatabaseHealth();
  
  res.json({ 
    status: 'ok', 
    service: 'keelo',
    version: '1.0.0',
    language: getLanguage(),
    llmProvider: keeloConfig.llm.provider,
    database: {
      enabled: isDatabaseEnabled(),
      healthy: dbHealthy,
    },
    websocket: {
      enabled: true,
      clients: getConnectedClients(),
    },
    features: {
      prAnalysis: true,
      requirementsAnalysis: true,
      coverageAnalysis: keeloConfig.coverage?.enabled ?? true,
      feedback: keeloConfig.feedback?.enabled ?? true,
      history: isDatabaseEnabled(),
    },
  });
});

// =============================================================================
// Routes - Auth (public - no token required)
// =============================================================================

app.use('/auth', authRoutes);

// =============================================================================
// Routes - History (Database) — protected by auth
// =============================================================================

app.use('/history', requireAuth, historyRoutes);
app.use('/organizations', requireAuth, organizationsRoutes);
app.use('/qa-health', requireAuth, qaHealthRoutes);
app.use('/settings', requireAuth, settingsRoutes);
app.use('/product-impact', requireAuth, productImpactRoutes);

// =============================================================================
// Routes - GitHub Webhook (PR Analysis)
// =============================================================================

app.post('/webhook', async (req, res) => {
  const signature = req.headers['x-hub-signature-256'] as string;
  const event = req.headers['x-github-event'] as string;
  const deliveryId = req.headers['x-github-delivery'] as string;
  const rawBody = (req as express.Request & { rawBody: string }).rawBody;

  logger.info({ event, deliveryId }, 'Webhook received');

  // Verify signature
  if (!signature) {
    logger.warn('Missing signature header');
    return res.status(401).json({ error: 'Missing signature' });
  }

  const isValid = await verifyWebhookSignature(rawBody, signature);
  if (!isValid) {
    logger.warn('Invalid webhook signature');
    return res.status(401).json({ error: 'Invalid signature' });
  }

  const triggerMode = getTriggerMode();

  // Handle issue_comment events (for /keelo commands)
  if (event === 'issue_comment') {
    const payload = req.body as IssueCommentPayload;
    
    // Only process new comments (not edits or deletes)
    if (payload.action !== 'created') {
      logger.info({ action: payload.action }, 'Ignoring non-created comment');
      return res.status(200).json({ message: 'Event ignored' });
    }
    
    // Respond immediately to avoid webhook timeout
    res.status(202).json({ message: 'Processing command' });
    
    // Process the command asynchronously
    try {
      await handleCommentCommand(payload);
    } catch (error) {
      logger.error({ error, deliveryId }, 'Failed to handle comment command');
    }
    return;
  }

  // Handle pull_request events based on trigger mode
  if (event === 'pull_request') {
    const decision = getPRTriggerDecision(triggerMode);

    // Command mode: ignore automatic analysis entirely
    if (!decision.shouldAnalyzeDashboard) {
      logger.info({ event, triggerMode }, 'Command mode enabled - ignoring automatic PR analysis');
      return res.status(200).json({ 
        message: 'Trigger mode is "command". Use /keelo analyze or /keelo generate tests in PR comments.' 
      });
    }

    // Hybrid mode: silent analysis (dashboard only, no PR comments)
    if (!decision.shouldCommentOnPR) {
      logger.info({ event, triggerMode }, 'Hybrid mode - running silent PR analysis (dashboard only)');
      
      // Respond immediately to avoid webhook timeout
      res.status(202).json({ message: 'Processing (silent/dashboard)' });

      // Process silently in the background
      try {
        await handleSilentPRAnalysis(req.body as WebhookPayload);
      } catch (error) {
        logger.error({ error, deliveryId }, 'Failed to handle silent PR analysis');
      }
      return;
    }

    // Auto mode: process PR automatically (full analysis + PR comment)
    logger.info({ event, triggerMode }, 'Auto mode - processing PR analysis');
    
    // Respond immediately to avoid webhook timeout
    res.status(202).json({ message: 'Processing' });

    // Process the event asynchronously
    try {
      await handlePullRequestEvent(req.body as WebhookPayload);
    } catch (error) {
      logger.error({ error, deliveryId }, 'Failed to handle webhook');
    }
    return;
  }

  // Ignore other events
  logger.info({ event }, 'Ignoring unsupported event');
  return res.status(200).json({ message: 'Event ignored' });
});

// =============================================================================
// Routes - Requirements Analysis (Pre-Implementation)
// =============================================================================

/**
 * POST /analyze/requirements
 * 
 * Analisa requisitos antes da implementação e gera cenários de teste.
 * 
 * Body:
 * - figmaUrl?: string - URL do Figma
 * - figmaImage?: string - Imagem base64 do design
 * - requirements?: string - Texto com requisitos/história de usuário
 * - pdfBase64?: string - PDF com requisitos em base64
 * - metadata?: { projectName?, featureName?, sprint?, priority? }
 * - format?: 'json' | 'markdown' - Formato de resposta (default: json)
 */
app.post('/analyze/requirements', requireAuth, async (req, res) => {
  try {
    const { 
      figmaUrl, 
      figmaImage, 
      requirements, 
      pdfBase64,
      metadata,
      format = 'json',
      async: asyncMode = true, // Default to async mode
      projectId,
      organizationId,
    } = req.body;

    logger.info({
      hasFigmaUrl: !!figmaUrl,
      hasFigmaImage: !!figmaImage,
      hasRequirements: !!requirements,
      hasPdf: !!pdfBase64,
      format,
      asyncMode,
    }, 'Requirements analysis request received');

    // Parse PDF if provided
    let pdfContent: string | undefined;
    if (pdfBase64) {
      try {
        const parsed = await parsePDFFromBase64(pdfBase64);
        pdfContent = parsed.content;
        logger.info({ pages: parsed.metadata.pages }, 'PDF parsed successfully');
      } catch (error) {
        logger.error({ error }, 'Failed to parse PDF');
        return res.status(400).json({ 
          error: 'Falha ao processar PDF',
          details: error instanceof Error ? error.message : 'Erro desconhecido',
        });
      }
    }

    // Build input
    const input: RequirementsInput = {
      figmaUrl,
      figmaImage,
      requirements,
      pdfContent,
      metadata,
    };

    // Validate input
    const validation = validateRequirementsInput(input);
    if (!validation.valid) {
      return res.status(400).json({ 
        error: 'Input inválido',
        details: validation.errors,
      });
    }

    const featureName = metadata?.featureName || 'Requirements Analysis';

    // For async mode with database, create pending record and process in background
    if (asyncMode && isDatabaseEnabled()) {
      // Create pending analysis record
      const analysisId = await createPendingRequirementsAnalysis(
        {
          projectName: metadata?.projectName,
          featureName: metadata?.featureName,
          sprint: metadata?.sprint,
        },
        { figmaUrl, requirements, hasPdf: !!pdfBase64 },
        req.user?.id,
        projectId,
        organizationId
      );

      // Emit WebSocket event - analysis queued
      emitAnalysisNew({
        id: analysisId,
        type: 'requirements',
        status: 'pending',
        feature_name: featureName,
        project_name: metadata?.projectName,
      });

      // Return immediately with the analysis ID
      res.json({
        success: true,
        analysisId,
        status: 'pending',
        message: 'Análise enfileirada. Você será notificado quando concluir.',
      });

      // Process in background (don't await)
      processRequirementsAsync(analysisId, input, featureName, {
        projectName: metadata?.projectName,
        sprint: metadata?.sprint,
      }).catch(error => {
        logger.error({ error, analysisId }, 'Background analysis failed');
      });

      return;
    }

    // Sync mode (legacy) - process immediately
    const tempId = `req-${Date.now()}`;

    // Emit WebSocket event - analysis starting
    emitAnalysisNew({
      id: tempId,
      type: 'requirements',
      status: 'processing',
      feature_name: featureName,
    });

    // Analyze requirements
    const result = await analyzeRequirements(input);

    // Save to database if enabled
    let analysisId: string | undefined;
    if (isDatabaseEnabled()) {
      try {
        analysisId = await createRequirementsAnalysis(
          {
            projectName: metadata?.projectName,
            featureName: metadata?.featureName,
            sprint: metadata?.sprint,
          },
          result,
          req.user?.id,
          projectId,
          organizationId
        );
      } catch (error) {
        logger.error({ error }, 'Failed to save analysis to database');
      }
    }

    // Emit WebSocket event - analysis completed
    emitAnalysisUpdate(
      analysisId || tempId,
      {
        status: 'completed',
        scenarios_count: result.scenarios?.length || 0,
        risks_count: result.risks?.length || 0,
        completed_at: new Date().toISOString(),
      }
    );

    // Emit notification
    emitNotification({
      type: 'analysis_complete',
      title: '✅ Análise de Requisitos Concluída',
      message: featureName,
      analysisId: analysisId || tempId,
    });

    // Return based on format
    if (format === 'markdown') {
      const markdown = formatRequirementsAnalysis(result);
      res.setHeader('Content-Type', 'text/markdown');
      return res.send(markdown);
    }

    res.json({
      success: true,
      analysisId,
      data: result,
    });
  } catch (error) {
    logger.error({ error }, 'Failed to analyze requirements');
    
    // Emit failure notification
    emitNotification({
      type: 'analysis_failed',
      title: '❌ Análise de Requisitos Falhou',
      message: error instanceof Error ? error.message : 'Erro desconhecido',
    });

    res.status(500).json({ 
      error: 'Falha na análise de requisitos',
      details: error instanceof Error ? error.message : 'Erro desconhecido',
    });
  }
});

/**
 * Background processor for async requirements analysis
 */
async function processRequirementsAsync(
  analysisId: string,
  input: RequirementsInput,
  featureName: string,
  metadata?: {
    projectName?: string;
    sprint?: string;
  }
): Promise<void> {
  try {
    // Mark as processing
    await markAnalysisProcessing(analysisId);
    
    emitAnalysisUpdate(analysisId, {
      status: 'processing',
    });

    logger.info({ analysisId }, 'Starting background requirements analysis');

    // Perform the analysis
    const result = await analyzeRequirements(input);

    // Save results
    await completeRequirementsAnalysis(analysisId, result);

    const overallRisk = result.risks?.[0]?.severity || 'medium';

    // Emit WebSocket event - analysis completed
    emitAnalysisUpdate(analysisId, {
      status: 'completed',
      scenarios_count: result.scenarios?.length || 0,
      risks_count: result.risks?.length || 0,
      gaps_count: result.gaps?.length || 0,
      overall_risk: overallRisk,
      summary_title: result.summary?.title,
      completed_at: new Date().toISOString(),
    });

    // Emit notification
    emitNotification({
      type: 'analysis_complete',
      title: '✅ Análise de Requisitos Concluída',
      message: featureName,
      analysisId,
    });

    // Send Slack notification if configured
    const slackConfig = getSlackConfig();
    if (slackConfig.enabled && slackConfig.webhookUrl) {
      const baseUrl = process.env.BASE_URL || `http://localhost:${config.server.port}`;
      const dashboardUrl = `${baseUrl}/analyses/${analysisId}`;
      
      await notifyRequirementsAnalysisComplete(slackConfig.webhookUrl, {
        analysisId,
        featureName,
        projectName: metadata?.projectName,
        sprint: metadata?.sprint,
        scenariosCount: result.scenarios?.length || 0,
        risksCount: result.risks?.length || 0,
        gapsCount: result.gaps?.length || 0,
        overallRisk,
        summaryTitle: result.summary?.title,
        dashboardUrl,
      });
      
      logger.info({ analysisId }, 'Slack notification sent');
    }

    logger.info({ 
      analysisId,
      scenarios: result.scenarios?.length,
      risks: result.risks?.length,
    }, 'Background requirements analysis completed');

  } catch (error) {
    logger.error({ error, analysisId }, 'Background requirements analysis failed');

    // Mark as failed
    await markAnalysisFailed(
      analysisId,
      error instanceof Error ? error.message : 'Erro desconhecido'
    );

    // Emit failure
    emitAnalysisUpdate(analysisId, {
      status: 'failed',
      error_message: error instanceof Error ? error.message : 'Erro desconhecido',
    });

    emitNotification({
      type: 'analysis_failed',
      title: '❌ Análise de Requisitos Falhou',
      message: error instanceof Error ? error.message : 'Erro desconhecido',
      analysisId,
    });
  }
}

/**
 * POST /analyze/figma
 * 
 * Analisa apenas um design do Figma.
 */
app.post('/analyze/figma', requireAuth, async (req, res) => {
  try {
    const { figmaUrl, figmaImage, context, metadata, projectId, organizationId } = req.body;

    if (!figmaUrl && !figmaImage) {
      return res.status(400).json({ 
        error: 'figmaUrl ou figmaImage é obrigatório',
      });
    }

    const input: RequirementsInput = {
      figmaUrl,
      figmaImage,
      requirements: context, // Use context as additional info
      metadata,
    };

    const result = await analyzeRequirements(input);

    // Save to database if enabled
    let analysisId: string | undefined;
    if (isDatabaseEnabled()) {
      try {
        analysisId = await createRequirementsAnalysis(
          {
            projectName: metadata?.projectName,
            featureName: metadata?.featureName || 'Figma Analysis',
            sprint: metadata?.sprint,
          },
          result,
          req.user?.id,
          projectId,
          organizationId
        );
      } catch (error) {
        logger.error({ error }, 'Failed to save analysis to database');
      }
    }

    res.json({
      success: true,
      analysisId,
      data: {
        uiAnalysis: result.uiAnalysis,
        scenarios: result.scenarios,
        accessibilityIssues: result.uiAnalysis?.accessibilityIssues || [],
        components: result.uiAnalysis?.components || [],
      },
    });
  } catch (error) {
    logger.error({ error }, 'Failed to analyze Figma');
    res.status(500).json({ 
      error: 'Falha na análise do Figma',
      details: error instanceof Error ? error.message : 'Erro desconhecido',
    });
  }
});

/**
 * POST /analyze/user-story
 * 
 * Analisa uma história de usuário e gera cenários de teste.
 */
app.post('/analyze/user-story', requireAuth, async (req, res) => {
  try {
    const { story, acceptanceCriteria, context, metadata, projectId, organizationId } = req.body;

    if (!story) {
      return res.status(400).json({ 
        error: 'story é obrigatório',
      });
    }

    // Combine story and criteria into requirements
    let requirements = `# História de Usuário\n\n${story}`;
    
    if (acceptanceCriteria) {
      requirements += `\n\n## Critérios de Aceite\n\n${acceptanceCriteria}`;
    }
    
    if (context) {
      requirements += `\n\n## Contexto Adicional\n\n${context}`;
    }

    const input: RequirementsInput = {
      requirements,
      metadata,
    };

    const result = await analyzeRequirements(input);

    // Save to database if enabled
    let analysisId: string | undefined;
    if (isDatabaseEnabled()) {
      try {
        analysisId = await createRequirementsAnalysis(
          {
            projectName: metadata?.projectName,
            featureName: metadata?.featureName || 'User Story Analysis',
            sprint: metadata?.sprint,
          },
          result,
          req.user?.id,
          projectId,
          organizationId
        );
      } catch (error) {
        logger.error({ error }, 'Failed to save analysis to database');
      }
    }

    res.json({
      success: true,
      analysisId,
      data: result,
    });
  } catch (error) {
    logger.error({ error }, 'Failed to analyze user story');
    res.status(500).json({ 
      error: 'Falha na análise da história de usuário',
      details: error instanceof Error ? error.message : 'Erro desconhecido',
    });
  }
});

// =============================================================================
// Routes - Documentation
// =============================================================================

app.get('/api', (_req, res) => {
  res.json({
    name: 'Keelo API',
    version: '1.0.0',
    description: 'Agente Autônomo de QA - Análise de PRs e Requisitos',
    database: isDatabaseEnabled() ? 'enabled' : 'disabled',
    endpoints: {
      'GET /health': 'Health check',
      'POST /webhook': 'GitHub webhook receiver (PR analysis)',
      'POST /analyze/requirements': 'Análise completa de requisitos (Figma + texto + PDF)',
      'POST /analyze/figma': 'Análise de design do Figma',
      'POST /analyze/user-story': 'Análise de história de usuário',
      'GET /history': 'Lista histórico de análises',
      'GET /history/stats': 'Estatísticas de análises',
      'GET /history/:id': 'Detalhes de uma análise',
      'GET /history/repository/:owner/:repo': 'Histórico de um repositório',
      'GET /product-impact/:analysisId': 'Relatório de impacto no produto',
      'GET /product-impact/:analysisId?format=markdown': 'Relatório de impacto (Markdown para PM/CTO)',
      'POST /product-impact/:analysisId/slack': 'Enviar relatório de impacto para Slack',
      'GET /product-impact/insights/aggregate': 'Insights agregados de produto',
      'POST /qa-health/report/weekly': 'Envia relatório semanal consolidado para Slack',
      'GET /qa-health/audience?role=cto|pm|qa': 'Métricas por perfil com sinal de confiabilidade',
    },
    examples: {
      '/analyze/requirements': {
        method: 'POST',
        body: {
          figmaImage: 'data:image/png;base64,...',
          requirements: 'Como um usuário, quero fazer login para acessar minha conta',
          pdfBase64: 'base64...',
          metadata: {
            projectName: 'Meu Projeto',
            featureName: 'Login',
            sprint: 'Sprint 10',
            priority: 'high',
          },
          format: 'json',
        },
      },
      '/analyze/user-story': {
        method: 'POST',
        body: {
          story: 'Como um usuário, quero fazer login para acessar minha conta',
          acceptanceCriteria: '- Usuário deve poder logar com email e senha\n- Deve mostrar erro se credenciais inválidas',
          context: 'Sistema de e-commerce',
        },
      },
      '/history': {
        method: 'GET',
        query: {
          type: 'pr|requirements|figma|user_story',
          repository: 'owner/repo',
          risk: 'critical|high|medium|low',
          limit: 50,
          offset: 0,
        },
      },
    },
  });
});

// =============================================================================
// Error Handling
// =============================================================================

app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  logger.error({ error: err.message }, 'Unhandled error');
  res.status(500).json({ error: 'Internal server error' });
});

// =============================================================================
// Server Startup
// =============================================================================

export async function startServer(): Promise<void> {
  // Initialize database
  initDatabase();
  
  // Load configuration from database
  try {
    const { configManager } = await import('../config/keelo-config.js');
    await configManager.loadFromDatabase();
    enforceHybridModeAtStartup(getTriggerMode(), config.server.enforceHybridTrigger);
  } catch (error) {
    logger.warn({ error }, 'Falha ao carregar configurações do banco, usando padrões');
  }
  
  const port = config.server.port;

  // Create HTTP server
  const httpServer = createServer(app);
  
  // Initialize WebSocket
  initWebSocket(httpServer);

  // Start periodic weekly quality report scheduler.
  startWeeklyReportScheduler();

  httpServer.listen(port, () => {
    logger.info({ 
      port, 
      language: getLanguage(),
      llmProvider: keeloConfig.llm.provider,
      model: keeloConfig.llm.model || 'default',
      database: isDatabaseEnabled() ? 'enabled' : 'disabled',
      websocket: 'enabled',
    }, '🚀 Keelo server started');
    logger.info('Endpoints:');
    logger.info('  - POST /webhook (GitHub PRs)');
    logger.info('  - POST /analyze/requirements');
    logger.info('  - POST /analyze/figma');
    logger.info('  - POST /analyze/user-story');
    logger.info('  - GET /history (análises)');
    logger.info('  - GET /product-impact (Pilar 3 - impacto no produto)');
    logger.info('  - WS /ws (WebSocket)');
    logger.info('  - GET /api (documentation)');
  });
}

// Start if run directly
if (process.argv[1]?.includes('server')) {
  startServer();
}

export default app;
