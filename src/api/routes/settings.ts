/**
 * Settings API Routes
 * 
 * Endpoints para gerenciar configurações do Keelo via dashboard
 * Todas as configurações são armazenadas no banco de dados
 */

import { Router, type Request, type Response } from 'express';
import { logger } from '../../config/index.js';
import { 
  getSettings, 
  updateSettings, 
  patchSettings, 
  resetSettings,
  getSettingsMetadata,
  type KeeloConfigDB,
} from '../../database/index.js';

const router = Router();

// =============================================================================
// Opções válidas para campos de seleção
// =============================================================================

export const CONFIG_OPTIONS = {
  language: [
    { value: 'pt-br', label: 'Português (Brasil)' },
    { value: 'en', label: 'English' },
  ],
  trigger: [
    { value: 'auto', label: 'Automático (ao abrir PR)' },
    { value: 'command', label: 'Via comando (/keelo)' },
    { value: 'hybrid', label: 'Híbrido (dashboard + sob demanda)' },
  ],
  llmProvider: [
    { value: 'anthropic', label: 'Anthropic (Claude)' },
    { value: 'openai', label: 'OpenAI (GPT)' },
  ],
  llmModel: {
    anthropic: [
      { value: 'claude-sonnet-4-20250514', label: 'Claude Sonnet 4 (Recomendado)' },
      { value: 'claude-3-5-sonnet-20241022', label: 'Claude 3.5 Sonnet' },
      { value: 'claude-3-opus-20240229', label: 'Claude 3 Opus' },
      { value: 'claude-3-haiku-20240307', label: 'Claude 3 Haiku (Rápido)' },
    ],
    openai: [
      { value: 'gpt-4o', label: 'GPT-4o (Recomendado)' },
      { value: 'gpt-4o-mini', label: 'GPT-4o Mini (Econômico)' },
      { value: 'gpt-4-turbo', label: 'GPT-4 Turbo' },
      { value: 'gpt-3.5-turbo', label: 'GPT-3.5 Turbo (Barato)' },
    ],
  },
  e2eFramework: [
    { value: 'playwright', label: 'Playwright' },
    { value: 'cypress', label: 'Cypress' },
    { value: 'puppeteer', label: 'Puppeteer' },
  ],
  unitFramework: [
    { value: 'vitest', label: 'Vitest' },
    { value: 'jest', label: 'Jest' },
    { value: 'mocha', label: 'Mocha' },
  ],
  apiFramework: [
    { value: 'supertest', label: 'Supertest' },
    { value: 'axios', label: 'Axios' },
    { value: 'fetch', label: 'Fetch' },
  ],
  baseBranchStrategy: [
    { value: 'default', label: 'Branch padrão (main/master)' },
    { value: 'pr-head', label: 'Branch do PR' },
  ],
  timezone: [
    { value: 'America/Sao_Paulo', label: 'São Paulo (BRT)' },
    { value: 'America/New_York', label: 'New York (EST)' },
    { value: 'Europe/London', label: 'London (GMT)' },
    { value: 'UTC', label: 'UTC' },
  ],
};

// =============================================================================
// Routes
// =============================================================================

/**
 * GET /settings - Retorna configurações atuais do banco de dados
 */
router.get('/', async (_req: Request, res: Response) => {
  try {
    const config = await getSettings();
    const metadata = await getSettingsMetadata();

    res.json({
      success: true,
      data: config,
      metadata,
    });
  } catch (error) {
    logger.error({ error }, 'Falha ao ler configurações');
    res.status(500).json({
      error: 'Falha ao ler configurações',
      details: error instanceof Error ? error.message : 'Erro desconhecido',
    });
  }
});

/**
 * GET /settings/options - Retorna opções válidas para cada campo
 */
router.get('/options', (_req: Request, res: Response) => {
  res.json({
    success: true,
    data: CONFIG_OPTIONS,
  });
});

/**
 * PUT /settings - Atualiza configurações completas
 */
router.put('/', async (req: Request, res: Response) => {
  try {
    const newConfig = req.body as KeeloConfigDB;

    if (!newConfig || typeof newConfig !== 'object') {
      return res.status(400).json({
        error: 'Configuração inválida',
      });
    }

    // Validar estrutura básica
    const requiredFields = ['language', 'llm', 'actions'];
    for (const field of requiredFields) {
      if (!(field in newConfig)) {
        return res.status(400).json({
          error: `Campo obrigatório ausente: ${field}`,
        });
      }
    }

    const savedConfig = await updateSettings(newConfig, 'dashboard');

    logger.info('Configurações atualizadas via dashboard');

    res.json({
      success: true,
      message: 'Configurações salvas com sucesso',
      data: savedConfig,
    });
  } catch (error) {
    logger.error({ error }, 'Falha ao salvar configurações');
    res.status(500).json({
      error: 'Falha ao salvar configurações',
      details: error instanceof Error ? error.message : 'Erro desconhecido',
    });
  }
});

/**
 * PATCH /settings - Atualiza parcialmente as configurações
 */
router.patch('/', async (req: Request, res: Response) => {
  try {
    const updates = req.body as Partial<KeeloConfigDB>;

    if (!updates || typeof updates !== 'object') {
      return res.status(400).json({
        error: 'Atualizações inválidas',
      });
    }

    const mergedConfig = await patchSettings(updates, 'dashboard');

    logger.info({ updates: Object.keys(updates) }, 'Configurações atualizadas parcialmente');

    res.json({
      success: true,
      message: 'Configurações atualizadas',
      data: mergedConfig,
    });
  } catch (error) {
    logger.error({ error }, 'Falha ao atualizar configurações');
    res.status(500).json({
      error: 'Falha ao atualizar configurações',
      details: error instanceof Error ? error.message : 'Erro desconhecido',
    });
  }
});

/**
 * POST /settings/reset - Reseta para configurações padrão
 */
router.post('/reset', async (_req: Request, res: Response) => {
  try {
    const defaultConfig = await resetSettings('dashboard');

    logger.info('Configurações resetadas para padrão');

    res.json({
      success: true,
      message: 'Configurações resetadas',
      data: defaultConfig,
    });
  } catch (error) {
    logger.error({ error }, 'Falha ao resetar configurações');
    res.status(500).json({
      error: 'Falha ao resetar configurações',
      details: error instanceof Error ? error.message : 'Erro desconhecido',
    });
  }
});

export default router;
