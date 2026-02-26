import { readFileSync, existsSync } from 'fs';
import { join } from 'path';
import { z } from 'zod';

const promptsDir = join(process.cwd(), 'prompts');

// =============================================================================
// Configuration Schema
// =============================================================================

const llmSchema = z.object({
  provider: z.enum(['openai', 'anthropic']).default('anthropic'),
  model: z.string().optional(),
  temperature: z.number().min(0).max(2).default(0.2),
  maxTokens: z.number().default(16000),
});

const testFrameworkSchema = z.object({
  e2e: z.enum(['playwright', 'cypress', 'puppeteer']).default('playwright'),
  unit: z.enum(['jest', 'vitest', 'mocha']).default('vitest'),
  api: z.enum(['supertest', 'pactum', 'frisby']).default('supertest'),
});

const autonomousSchema = z.object({
  enabled: z.boolean().default(false),
  createPR: z.boolean().default(true),
  monitorCI: z.boolean().default(true),
  autoFix: z.boolean().default(true),
  baseBranchStrategy: z.enum(['default', 'pr-head']).default('default'),
});

const slackNotifySchema = z.object({
  analysis: z.boolean().default(true),
  testPRCreated: z.boolean().default(true),
  ciFailure: z.boolean().default(true),
  criticalRisk: z.boolean().default(true),
});

const slackSchema = z.object({
  enabled: z.boolean().default(false),
  webhookUrl: z.string().default(''),
  channel: z.string().optional(),
  notifyOn: slackNotifySchema.default({}),
});

const actionsSchema = z.object({
  autoCreateIssues: z.boolean().default(false),
  autoGenerateTests: z.boolean().default(false),
  autoCreateTasks: z.boolean().default(false),
  createDraftPRs: z.boolean().default(true),
  issueLabels: z.array(z.string()).default(['keelo', 'qa']),
  autonomous: autonomousSchema.default({}),
});

const coverageSchema = z.object({
  enabled: z.boolean().default(true),
  minThreshold: z.number().min(0).max(100).default(80),
  failOnDecrease: z.boolean().default(false),
  suggestTests: z.boolean().default(true),
});

const feedbackSchema = z.object({
  enabled: z.boolean().default(true),
  collectReactions: z.boolean().default(true),
  useLearning: z.boolean().default(true),
  showStats: z.boolean().default(false),
});

const triggerSchema = z.enum(['auto', 'command', 'hybrid']).default('hybrid');

const keeloConfigSchema = z.object({
  language: z.enum(['en', 'pt-br']).default('pt-br'),
  trigger: triggerSchema,
  llm: llmSchema.default({}),
  testFrameworks: testFrameworkSchema.default({}),
  actions: actionsSchema.default({}),
  notifications: z.object({
    slack: slackSchema.default({}),
  }).default({}),
  coverage: coverageSchema.default({}),
  feedback: feedbackSchema.default({}),
  testOutputDir: z.string().default('tests/generated'),
});

export type KeeloConfig = z.infer<typeof keeloConfigSchema>;
export type Language = KeeloConfig['language'];
export type TriggerMode = z.infer<typeof triggerSchema>;
export type LLMConfig = z.infer<typeof llmSchema>;
export type TestFrameworks = KeeloConfig['testFrameworks'];
export type AutonomousConfig = z.infer<typeof autonomousSchema>;
export type SlackConfig = z.infer<typeof slackSchema>;
export type CoverageConfig = z.infer<typeof coverageSchema>;
export type FeedbackConfig = z.infer<typeof feedbackSchema>;

// Default models per provider
export const DEFAULT_MODELS: Record<LLMConfig['provider'], string> = {
  openai: 'gpt-4-turbo-preview',
  anthropic: 'claude-sonnet-4-20250514',
};

// =============================================================================
// Default Configuration (used when DB is not available)
// =============================================================================

export const DEFAULT_CONFIG: KeeloConfig = {
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
// Configuration Manager (loads from database)
// =============================================================================

class ConfigManager {
  private config: KeeloConfig = DEFAULT_CONFIG;
  private loaded = false;
  private loading: Promise<void> | null = null;

  /**
   * Load configuration from database
   */
  async loadFromDatabase(): Promise<void> {
    // Prevent concurrent loading
    if (this.loading) {
      await this.loading;
      return;
    }

    this.loading = this._loadFromDatabase();
    await this.loading;
    this.loading = null;
  }

  private async _loadFromDatabase(): Promise<void> {
    try {
      // Dynamic import to avoid circular dependency
      const { getSettings } = await import('../database/repositories/settings-repository.js');
      const dbConfig = await getSettings();
      
      // Validate and merge with defaults
      this.config = keeloConfigSchema.parse(dbConfig);
      this.loaded = true;
      console.log('✅ Configurações carregadas do banco de dados');
    } catch (error) {
      console.warn('⚠️ Falha ao carregar configurações do banco, usando padrões:', error);
      this.config = DEFAULT_CONFIG;
      this.loaded = true;
    }
  }

  /**
   * Get current configuration
   * If not loaded from DB yet, returns defaults
   */
  getConfig(): KeeloConfig {
    return this.config;
  }

  /**
   * Reload configuration from database
   */
  async reload(): Promise<void> {
    this.loaded = false;
    await this.loadFromDatabase();
  }

  /**
   * Check if config was loaded from database
   */
  isLoaded(): boolean {
    return this.loaded;
  }
}

// Singleton instance
export const configManager = new ConfigManager();

// For backward compatibility - returns current config (may be defaults if DB not loaded yet)
export const keeloConfig = new Proxy({} as KeeloConfig, {
  get(_target, prop) {
    return configManager.getConfig()[prop as keyof KeeloConfig];
  },
});

// =============================================================================
// Prompt Loading
// =============================================================================

function loadPrompt(filename: string): string {
  const filePath = join(promptsDir, filename);
  if (!existsSync(filePath)) {
    throw new Error(`Prompt file not found: ${filePath}`);
  }
  return readFileSync(filePath, 'utf-8');
}

function loadPromptOptional(filename: string): string | null {
  const filePath = join(promptsDir, filename);
  if (!existsSync(filePath)) {
    return null;
  }
  return readFileSync(filePath, 'utf-8');
}

// Lazy load prompts based on current language
export function getSystemPrompt(): string {
  const lang = configManager.getConfig().language;
  return loadPrompt(`system.${lang}.md`);
}

export function getUserPromptTemplate(): string {
  const lang = configManager.getConfig().language;
  return loadPrompt(`user.${lang}.md`);
}

export function getTestGenPrompt(): string {
  const lang = configManager.getConfig().language;
  return loadPromptOptional(`test-generator.${lang}.md`) 
    || loadPromptOptional('test-generator.en.md') 
    || '';
}

// Legacy exports (for compatibility)
export const SYSTEM_PROMPT = loadPrompt('system.pt-br.md');
export const TEST_GEN_PROMPT = loadPromptOptional('test-generator.pt-br.md') 
  || loadPromptOptional('test-generator.en.md') 
  || '';

// =============================================================================
// Configuration Getters
// =============================================================================

export function buildUserPrompt(
  title: string,
  description: string,
  diff: string
): string {
  return getUserPromptTemplate()
    .replace('{{title}}', title)
    .replace('{{description}}', description)
    .replace('{{diff}}', diff);
}

export function getLanguage(): Language {
  return configManager.getConfig().language;
}

export function getLLMConfig(): LLMConfig {
  return configManager.getConfig().llm;
}

export function getTestFrameworks(): TestFrameworks {
  return configManager.getConfig().testFrameworks;
}

export function getActions(): KeeloConfig['actions'] {
  return configManager.getConfig().actions;
}

export function isAutonomousEnabled(): boolean {
  return configManager.getConfig().actions.autonomous?.enabled ?? false;
}

export function getSlackConfig(): SlackConfig {
  const config = { ...configManager.getConfig().notifications.slack };
  
  // Resolve environment variable placeholders in webhookUrl
  if (config.webhookUrl) {
    const envMatch = config.webhookUrl.match(/^\$\{(.+)\}$/);
    if (envMatch) {
      const envVarName = envMatch[1];
      config.webhookUrl = process.env[envVarName] || '';
    }
    if (config.webhookUrl === '' || config.webhookUrl.startsWith('${')) {
      config.webhookUrl = process.env.SLACK_WEBHOOK_URL || '';
    }
  } else {
    config.webhookUrl = process.env.SLACK_WEBHOOK_URL || '';
  }
  
  return config;
}

export function getCoverageConfig(): CoverageConfig {
  return configManager.getConfig().coverage;
}

export function getFeedbackConfig(): FeedbackConfig {
  return configManager.getConfig().feedback;
}

export function getTriggerMode(): TriggerMode {
  return configManager.getConfig().trigger;
}

export function isCommandMode(): boolean {
  return configManager.getConfig().trigger === 'command';
}

export function isAutoMode(): boolean {
  return configManager.getConfig().trigger === 'auto';
}

export function isHybridMode(): boolean {
  return configManager.getConfig().trigger === 'hybrid';
}
