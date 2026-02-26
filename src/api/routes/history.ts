import { Router, Request, Response } from 'express';
import { logger } from '../../config/index.js';
import {
  isDatabaseEnabled,
  getAnalyses,
  getAnalysisById,
  getAnalysisSummary,
  getPRAnalysisHistory,
  getStatistics,
  getRepositories,
  createRepository,
  deleteRepository,
  getRepositoryById,
  getHotspots,
  getHotspotsByArea,
  getHotspotSummary,
  type AnalysisFilter,
} from '../../database/index.js';

const router = Router();

// =============================================================================
// Middleware
// =============================================================================

function requireDatabase(_req: Request, res: Response, next: () => void) {
  if (!isDatabaseEnabled()) {
    return res.status(503).json({
      error: 'Banco de dados não configurado',
      message: 'Configure DATABASE_URL para habilitar o histórico de análises',
    });
  }
  next();
}

// =============================================================================
// Routes - IMPORTANT: Specific routes MUST come before wildcard routes (/:id)
// =============================================================================

/**
 * GET /history
 * 
 * Lista todas as análises com filtros
 */
router.get('/', requireDatabase, async (req: Request, res: Response) => {
  try {
    const filter: AnalysisFilter = {
      type: req.query.type as AnalysisFilter['type'],
      triggerSource: req.query.trigger as AnalysisFilter['triggerSource'],
      repositoryFullName: req.query.repository as string,
      status: req.query.status as string,
      overallRisk: req.query.risk as AnalysisFilter['overallRisk'],
      limit: parseInt(req.query.limit as string, 10) || 50,
      offset: parseInt(req.query.offset as string, 10) || 0,
      userId: req.user?.id,
      isAdmin: req.user?.role === 'admin',
      projectId: req.query.projectId as string,
      organizationId: req.query.organizationId as string,
    };

    if (req.query.from) {
      filter.fromDate = new Date(req.query.from as string);
    }
    if (req.query.to) {
      filter.toDate = new Date(req.query.to as string);
    }

    const analyses = await getAnalyses(filter);

    res.json({
      success: true,
      data: analyses,
      pagination: {
        limit: filter.limit,
        offset: filter.offset,
        count: analyses.length,
      },
    });
  } catch (error) {
    logger.error({ error }, 'Failed to fetch analysis history');
    res.status(500).json({
      error: 'Falha ao buscar histórico',
      details: error instanceof Error ? error.message : 'Erro desconhecido',
    });
  }
});

/**
 * GET /history/stats
 * 
 * Retorna estatísticas gerais
 */
router.get('/stats', requireDatabase, async (req: Request, res: Response) => {
  try {
    const stats = await getStatistics(
      req.user?.id,
      req.user?.role === 'admin',
      req.query.projectId as string,
      req.query.organizationId as string
    );

    res.json({
      success: true,
      data: stats,
    });
  } catch (error) {
    logger.error({ error }, 'Failed to fetch statistics');
    res.status(500).json({
      error: 'Falha ao buscar estatísticas',
      details: error instanceof Error ? error.message : 'Erro desconhecido',
    });
  }
});

/**
 * GET /history/repositories
 * 
 * Lista todos os repositórios/projetos com contagem de análises
 */
router.get('/repositories', requireDatabase, async (req: Request, res: Response) => {
  try {
    const repositories = await getRepositories(req.user?.id, req.user?.role === 'admin');

    res.json({
      success: true,
      data: repositories,
    });
  } catch (error) {
    logger.error({ error }, 'Failed to fetch repositories');
    res.status(500).json({
      error: 'Falha ao buscar repositórios',
      details: error instanceof Error ? error.message : 'Erro desconhecido',
    });
  }
});

/**
 * POST /history/repositories
 * 
 * Adiciona um novo repositório/projeto manualmente
 */
router.post('/repositories', requireDatabase, async (req: Request, res: Response) => {
  try {
    const { fullName } = req.body;

    if (!fullName || typeof fullName !== 'string') {
      return res.status(400).json({
        error: 'Campo fullName é obrigatório',
        message: 'Informe o nome do repositório no formato: owner/repo',
      });
    }

    if (!fullName.includes('/')) {
      return res.status(400).json({
        error: 'Formato inválido',
        message: 'Use o formato: owner/repo (ex: minha-org/meu-projeto)',
      });
    }

    const repository = await createRepository(fullName, req.user?.id);

    res.status(201).json({
      success: true,
      data: repository,
      message: `Projeto ${fullName} adicionado com sucesso`,
    });
  } catch (error) {
    logger.error({ error }, 'Failed to create repository');
    res.status(500).json({
      error: 'Falha ao criar repositório',
      details: error instanceof Error ? error.message : 'Erro desconhecido',
    });
  }
});

/**
 * DELETE /history/repositories/:id
 * 
 * Remove um repositório e todas as suas análises
 */
router.delete('/repositories/:id', requireDatabase, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    // Get repo info before deleting
    const repo = await getRepositoryById(id);
    if (!repo) {
      return res.status(404).json({
        error: 'Repositório não encontrado',
      });
    }

    const deleted = await deleteRepository(id, req.user?.id, req.user?.role === 'admin');

    if (deleted) {
      res.json({
        success: true,
        message: `Projeto ${repo.full_name} e todas as suas análises foram removidos`,
      });
    } else {
      res.status(404).json({
        error: 'Repositório não encontrado',
      });
    }
  } catch (error) {
    logger.error({ error }, 'Failed to delete repository');
    res.status(500).json({
      error: 'Falha ao excluir repositório',
      details: error instanceof Error ? error.message : 'Erro desconhecido',
    });
  }
});

// =============================================================================
// Hot Spots Endpoints (MUST come before /:id wildcard)
// =============================================================================

/**
 * GET /history/hotspots
 * 
 * Retorna áreas de risco (hot spots) do código
 */
router.get('/hotspots', requireDatabase, async (req: Request, res: Response) => {
  try {
    const repository = req.query.repository as string | undefined;
    const limit = parseInt(req.query.limit as string, 10) || 20;

    const hotspots = await getHotspots(repository, limit);

    res.json({
      success: true,
      data: hotspots,
    });
  } catch (error) {
    logger.error({ error }, 'Failed to fetch hotspots');
    res.status(500).json({
      error: 'Falha ao buscar hot spots',
      details: error instanceof Error ? error.message : 'Erro desconhecido',
    });
  }
});

/**
 * GET /history/hotspots/summary
 * 
 * Retorna resumo dos hot spots
 */
router.get('/hotspots/summary', requireDatabase, async (req: Request, res: Response) => {
  try {
    const repository = req.query.repository as string | undefined;

    const summary = await getHotspotSummary(repository);

    res.json({
      success: true,
      data: summary,
    });
  } catch (error) {
    logger.error({ error }, 'Failed to fetch hotspot summary');
    res.status(500).json({
      error: 'Falha ao buscar resumo de hot spots',
      details: error instanceof Error ? error.message : 'Erro desconhecido',
    });
  }
});

/**
 * GET /history/hotspots/area/:area
 * 
 * Retorna hot spots de uma área específica
 */
router.get('/hotspots/area/:area', requireDatabase, async (req: Request, res: Response) => {
  try {
    const { area } = req.params;
    const limit = parseInt(req.query.limit as string, 10) || 10;

    const hotspots = await getHotspotsByArea(area, limit);

    res.json({
      success: true,
      data: hotspots,
      area,
    });
  } catch (error) {
    logger.error({ error }, 'Failed to fetch hotspots by area');
    res.status(500).json({
      error: 'Falha ao buscar hot spots por área',
      details: error instanceof Error ? error.message : 'Erro desconhecido',
    });
  }
});

/**
 * GET /history/repository/:owner/:repo
 * 
 * Retorna histórico de análises de um repositório
 */
router.get('/repository/:owner/:repo', requireDatabase, async (req: Request, res: Response) => {
  try {
    const { owner, repo } = req.params;
    const limit = parseInt(req.query.limit as string, 10) || 20;

    const analyses = await getPRAnalysisHistory(owner, repo, limit);

    res.json({
      success: true,
      data: analyses,
      repository: `${owner}/${repo}`,
    });
  } catch (error) {
    logger.error({ error }, 'Failed to fetch repository history');
    res.status(500).json({
      error: 'Falha ao buscar histórico do repositório',
      details: error instanceof Error ? error.message : 'Erro desconhecido',
    });
  }
});

// =============================================================================
// Wildcard Routes (MUST come LAST)
// =============================================================================

/**
 * GET /history/:id
 * 
 * Retorna uma análise específica por ID
 */
router.get('/:id', requireDatabase, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    
    const analysis = await getAnalysisById(id);
    
    if (!analysis) {
      return res.status(404).json({
        error: 'Análise não encontrada',
      });
    }

    res.json({
      success: true,
      data: analysis,
    });
  } catch (error) {
    logger.error({ error }, 'Failed to fetch analysis');
    res.status(500).json({
      error: 'Falha ao buscar análise',
      details: error instanceof Error ? error.message : 'Erro desconhecido',
    });
  }
});

/**
 * GET /history/:id/details
 * 
 * Retorna análise com cenários, riscos e gaps
 */
router.get('/:id/details', requireDatabase, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    
    const summary = await getAnalysisSummary(id);
    
    if (!summary.analysis) {
      return res.status(404).json({
        error: 'Análise não encontrada',
      });
    }

    res.json({
      success: true,
      data: summary,
    });
  } catch (error) {
    logger.error({ error }, 'Failed to fetch analysis details');
    res.status(500).json({
      error: 'Falha ao buscar detalhes da análise',
      details: error instanceof Error ? error.message : 'Erro desconhecido',
    });
  }
});

export default router;
