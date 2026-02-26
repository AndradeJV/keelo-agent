/**
 * Settings Repository
 * 
 * Manages Keelo configuration in the database
 */

import { query, queryOne, isDatabaseEnabled } from '../connection.js';
import { logger } from '../../config/logger.js';

// =============================================================================
// Types
// =============================================================================

export interface KeeloConfigDB {
  language: 'en' | 'pt-br';
  trigger: 'auto' | 'command' | 'hybrid';
  llm: {
    provider: 'openai' | 'anthropic';
    model?: string;
    temperature: number;
    maxTokens: number;
  };
  testFrameworks: {
    e2e: 'playwright' | 'cypress' | 'puppeteer';
    unit: 'jest' | 'vitest' | 'mocha';
    api: 'supertest' | 'pactum' | 'frisby';
  };
  actions: {
    autoCreateIssues: boolean;
    autoGenerateTests: boolean;
    autoCreateTasks: boolean;
    createDraftPRs: boolean;
    issueLabels: string[];
    autonomous: {
      enabled: boolean;
      createPR: boolean;
      monitorCI: boolean;
      autoFix: boolean;
      baseBranchStrategy: 'default' | 'pr-head';
    };
  };
  runtime: {
    enabled: boolean;
    schedule: string;
    timezone: string;
    maxPages: number;
    maxDepth: number;
    environments: Record<string, {
      baseUrl: string;
      auth?: {
        username: string;
        password: string;
      };
    }>;
    criticalFlows: Array<{
      name: string;
      steps: string[];
    }>;
    codeAware?: {
      enabled: boolean;
      repoPath?: string;
      githubRepo?: string;
      excludePaths?: string[];
    };
  };
  notifications: {
    slack: {
      enabled: boolean;
      webhookUrl: string;
      channel?: string;
      notifyOn: {
        analysis: boolean;
        testPRCreated: boolean;
        ciFailure: boolean;
        criticalRisk: boolean;
      };
    };
  };
  coverage: {
    enabled: boolean;
    minThreshold: number;
    failOnDecrease: boolean;
    suggestTests: boolean;
  };
  feedback: {
    enabled: boolean;
    collectReactions: boolean;
    useLearning: boolean;
    showStats: boolean;
  };
  testOutputDir: string;
}

// =============================================================================
// Default Configuration
// =============================================================================

export const DEFAULT_CONFIG_DB: KeeloConfigDB = {
  language: 'pt-br',
  trigger: 'hybrid',
  llm: {
    provider: 'anthropic',
    model: 'claude-sonnet-4-20250514',
    temperature: 0.2,
    maxTokens: 16000,
  },
  testFrameworks: {
    e2e: 'playwright',
    unit: 'vitest',
    api: 'supertest',
  },
  actions: {
    autoGenerateTests: true,
    autoCreateIssues: false,
    autoCreateTasks: false,
    createDraftPRs: true,
    issueLabels: ['keelo', 'qa', 'automated'],
    autonomous: {
      enabled: true,
      createPR: true,
      monitorCI: true,
      autoFix: false,
      baseBranchStrategy: 'default',
    },
  },
  runtime: {
    enabled: false,
    schedule: '0 3 * * *',
    timezone: 'America/Sao_Paulo',
    maxPages: 50,
    maxDepth: 3,
    environments: {},
    criticalFlows: [],
    codeAware: {
      enabled: false,
      repoPath: '',
      githubRepo: '',
      excludePaths: ['node_modules', '.git', 'dist', 'build'],
    },
  },
  notifications: {
    slack: {
      enabled: false,
      webhookUrl: '',
      channel: '#qa-alerts',
      notifyOn: {
        analysis: true,
        testPRCreated: true,
        ciFailure: true,
        criticalRisk: true,
      },
    },
  },
  coverage: {
    enabled: true,
    minThreshold: 80,
    failOnDecrease: false,
    suggestTests: true,
  },
  feedback: {
    enabled: true,
    collectReactions: true,
    useLearning: true,
    showStats: true,
  },
  testOutputDir: 'tests/generated',
};

// =============================================================================
// Repository Functions
// =============================================================================

/**
 * Get the current configuration from database
 */
export async function getSettings(): Promise<KeeloConfigDB> {
  if (!isDatabaseEnabled()) {
    logger.warn('Database not enabled, returning default config');
    return DEFAULT_CONFIG_DB;
  }

  try {
    const result = await queryOne<{ value: KeeloConfigDB }>(
      'SELECT value FROM keelo_settings WHERE key = $1',
      ['config']
    );

    if (!result) {
      // No config in DB, insert default and return it
      await query(
        `INSERT INTO keelo_settings (key, value, updated_by) 
         VALUES ($1, $2, $3)
         ON CONFLICT (key) DO NOTHING`,
        ['config', JSON.stringify(DEFAULT_CONFIG_DB), 'system']
      );
      return DEFAULT_CONFIG_DB;
    }

    return result.value as KeeloConfigDB;
  } catch (error) {
    logger.error({ error }, 'Failed to get settings from database');
    // Return default config if DB fails
    return DEFAULT_CONFIG_DB;
  }
}

/**
 * Update the entire configuration
 */
export async function updateSettings(
  config: KeeloConfigDB, 
  updatedBy: string = 'dashboard'
): Promise<KeeloConfigDB> {
  if (!isDatabaseEnabled()) {
    throw new Error('Database not enabled');
  }

  try {
    const result = await queryOne<{ value: KeeloConfigDB }>(
      `INSERT INTO keelo_settings (key, value, updated_at, updated_by)
       VALUES ($1, $2, NOW(), $3)
       ON CONFLICT (key) 
       DO UPDATE SET value = $2, updated_at = NOW(), updated_by = $3
       RETURNING value`,
      ['config', JSON.stringify(config), updatedBy]
    );

    logger.info({ updatedBy }, 'Settings updated via database');
    return result?.value as KeeloConfigDB;
  } catch (error) {
    logger.error({ error }, 'Failed to update settings in database');
    throw error;
  }
}

/**
 * Partially update configuration (merge with existing)
 */
export async function patchSettings(
  partialConfig: Partial<KeeloConfigDB>,
  updatedBy: string = 'dashboard'
): Promise<KeeloConfigDB> {
  try {
    // Get current config
    const current = await getSettings();
    
    // Deep merge
    const merged = deepMerge(current, partialConfig);
    
    // Save merged config
    return await updateSettings(merged as KeeloConfigDB, updatedBy);
  } catch (error) {
    logger.error({ error }, 'Failed to patch settings in database');
    throw error;
  }
}

/**
 * Reset configuration to defaults
 */
export async function resetSettings(
  updatedBy: string = 'dashboard'
): Promise<KeeloConfigDB> {
  return await updateSettings(DEFAULT_CONFIG_DB, updatedBy);
}

/**
 * Get settings metadata (last updated, etc)
 */
export async function getSettingsMetadata(): Promise<{
  updatedAt: Date;
  updatedBy: string;
} | null> {
  if (!isDatabaseEnabled()) {
    return null;
  }

  try {
    const result = await queryOne<{ updated_at: Date; updated_by: string }>(
      'SELECT updated_at, updated_by FROM keelo_settings WHERE key = $1',
      ['config']
    );

    if (!result) {
      return null;
    }

    return {
      updatedAt: result.updated_at,
      updatedBy: result.updated_by,
    };
  } catch (error) {
    logger.error({ error }, 'Failed to get settings metadata');
    return null;
  }
}

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Deep merge two objects
 */
function deepMerge(target: any, source: any): any {
  const result = { ...target };
  
  for (const key in source) {
    if (source[key] !== undefined) {
      if (
        typeof source[key] === 'object' && 
        source[key] !== null && 
        !Array.isArray(source[key])
      ) {
        result[key] = deepMerge(target[key] || {}, source[key]);
      } else {
        result[key] = source[key];
      }
    }
  }
  
  return result;
}

