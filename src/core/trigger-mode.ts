import { logger } from '../config/index.js';
import type { TriggerMode } from '../config/index.js';

export interface TriggerModeDecision {
  shouldAnalyzeDashboard: boolean;
  shouldCommentOnPR: boolean;
  mode: TriggerMode;
}

export function getPRTriggerDecision(mode: TriggerMode): TriggerModeDecision {
  switch (mode) {
    case 'hybrid':
      return {
        shouldAnalyzeDashboard: true,
        shouldCommentOnPR: false,
        mode,
      };
    case 'auto':
      return {
        shouldAnalyzeDashboard: true,
        shouldCommentOnPR: true,
        mode,
      };
    case 'command':
      return {
        shouldAnalyzeDashboard: false,
        shouldCommentOnPR: false,
        mode,
      };
  }
}

export function enforceHybridModeAtStartup(
  mode: TriggerMode,
  strict: boolean
): void {
  if (mode === 'hybrid') {
    logger.info({ triggerMode: mode }, 'Hybrid trigger mode enforced for dashboard-first workflow');
    return;
  }

  const message = 'Trigger mode is not hybrid. PR dashboard coverage for all PRs is not guaranteed.';

  if (strict) {
    throw new Error(message);
  }

  logger.warn({ triggerMode: mode }, message);
}

