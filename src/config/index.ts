/**
 * Configuration Module
 * 
 * Centralized configuration management for:
 * - Environment variables (.env)
 * - Keelo configuration (.keelo.json)
 * - Logging
 */

export { config } from './env.js';
export { 
  keeloConfig,
  configManager,
  SYSTEM_PROMPT,
  TEST_GEN_PROMPT,
  DEFAULT_MODELS,
  DEFAULT_CONFIG,
  getSystemPrompt,
  getUserPromptTemplate,
  getTestGenPrompt,
  buildUserPrompt,
  getLanguage,
  getLLMConfig,
  getTestFrameworks,
  getActions,
  isAutonomousEnabled,
  getSlackConfig,
  getCoverageConfig,
  getFeedbackConfig,
  getTriggerMode,
  isCommandMode,
  isAutoMode,
  isHybridMode,
  type KeeloConfig,
  type Language,
  type TriggerMode,
  type LLMConfig,
  type TestFrameworks,
  type AutonomousConfig,
  type SlackConfig,
  type CoverageConfig,
  type FeedbackConfig,
} from './keelo-config.js';
export { logger } from './logger.js';

