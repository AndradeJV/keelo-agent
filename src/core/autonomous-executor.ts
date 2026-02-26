import { logger, keeloConfig } from '../config/index.js';
import { generateTests, type GeneratedTest, type TestGenerationResult } from './test-generator.js';
import { attemptAutoFix, type AutoFixResult } from './ci-fixer.js';
import { 
  createBranch, 
  commitTestFiles, 
  getDefaultBranch,
  generateTestBranchName,
  getPRHeadSha,
  createTestPullRequest, 
  getPRChecksStatus, 
  reportCIFailures,
  type CreatedPullRequest,
} from '../integrations/github/index.js';
import type { AnalysisResult, PullRequestContext } from './types.js';

// =============================================================================
// Types
// =============================================================================

export interface AutonomousExecutionResult {
  testsGenerated: GeneratedTest[];
  testPR?: CreatedPullRequest;
  ciStatus?: 'pending' | 'success' | 'failure';
  autoFixResult?: AutoFixResult;
  errors: string[];
}

// Store original tests for auto-fix context
const testContextStore = new Map<number, GeneratedTest[]>();

// =============================================================================
// Main Executor
// =============================================================================

export async function executeAutonomously(
  analysis: AnalysisResult,
  context: PullRequestContext
): Promise<AutonomousExecutionResult> {
  const result: AutonomousExecutionResult = {
    testsGenerated: [],
    errors: [],
  };

  const autonomousConfig = keeloConfig.actions.autonomous;
  
  if (!autonomousConfig?.enabled) {
    logger.info('Autonomous execution is disabled');
    return result;
  }

  try {
    // Step 1: Generate tests
    logger.info({ pr: context.pullNumber }, 'Step 1: Generating tests...');
    const testResult = await generateTests(analysis, context);
    
    if (testResult.tests.length === 0) {
      logger.info('No tests generated, skipping autonomous execution');
      return result;
    }
    
    result.testsGenerated = testResult.tests;
    logger.info({ count: testResult.tests.length }, 'Tests generated successfully');

    // Step 2: Create branch
    logger.info({ pr: context.pullNumber }, 'Step 2: Creating branch...');
    const branchName = generateTestBranchName(context.pullNumber);
    
    // Get base branch (either PR head or default branch based on config)
    const baseBranchInfo = autonomousConfig.baseBranchStrategy === 'pr-head'
      ? { sha: await getPRHeadSha(context), name: `pr-${context.pullNumber}-head` }
      : await getDefaultBranch(context);
    
    await createBranch(context, branchName, baseBranchInfo.sha);
    logger.info({ branch: branchName }, 'Branch created');

    // Step 3: Commit test files
    logger.info({ pr: context.pullNumber }, 'Step 3: Committing tests...');
    const commitResult = await commitTestFiles(
      context,
      branchName,
      testResult.tests,
      keeloConfig.testOutputDir
    );
    logger.info({ sha: commitResult.sha }, 'Tests committed');

    // Step 4: Create PR
    if (autonomousConfig.createPR) {
      logger.info({ pr: context.pullNumber }, 'Step 4: Creating test PR...');
      const defaultBranch = await getDefaultBranch(context);
      
      result.testPR = await createTestPullRequest(
        context,
        commitResult,
        testResult.tests,
        defaultBranch.name
      );
      logger.info({ testPR: result.testPR.number }, 'Test PR created');

      // Store tests for potential auto-fix
      testContextStore.set(result.testPR.number, testResult.tests);

      // Step 5: Monitor CI (optional, async)
      if (autonomousConfig.monitorCI) {
        // Schedule CI monitoring for later (non-blocking)
        scheduleCIMonitoring(context, result.testPR.number, testResult.tests);
      }
    }

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    result.errors.push(errorMessage);
    logger.error({ error }, 'Autonomous execution failed');
  }

  return result;
}

// =============================================================================
// CI Monitoring with Auto-Fix
// =============================================================================

async function scheduleCIMonitoring(
  context: PullRequestContext,
  prNumber: number,
  originalTests: GeneratedTest[]
): Promise<void> {
  const checkIntervalMs = 30000; // 30 seconds
  const maxChecks = 20; // 10 minutes max
  let checks = 0;
  let autoFixAttempted = false;

  const autonomousConfig = keeloConfig.actions.autonomous;
  const autoFixEnabled = autonomousConfig?.autoFix !== false; // Default to true if not specified

  const monitor = async () => {
    checks++;
    
    if (checks > maxChecks) {
      logger.warn({ prNumber }, 'CI monitoring timeout reached');
      // Clean up stored tests
      testContextStore.delete(prNumber);
      return;
    }

    try {
      const { status, checks: checkResults } = await getPRChecksStatus(context, prNumber);
      
      if (status === 'pending') {
        // Still running, check again later
        setTimeout(monitor, checkIntervalMs);
        return;
      }

      if (status === 'failure') {
        const failedChecks = checkResults.filter(c => c.conclusion === 'failure');
        
        // Try auto-fix if enabled and not already attempted
        if (autoFixEnabled && !autoFixAttempted && failedChecks.length > 0) {
          logger.info({ prNumber, failedChecks: failedChecks.length }, '🔧 Attempting auto-fix...');
          autoFixAttempted = true;
          
          const fixResult = await attemptAutoFix(
            context,
            prNumber,
            failedChecks,
            originalTests
          );

          if (fixResult.success) {
            // Reset check counter and continue monitoring for the new commit
            checks = 0;
            logger.info({ prNumber }, 'Auto-fix applied, continuing to monitor CI');
            setTimeout(monitor, checkIntervalMs);
            return;
          } else {
            // Auto-fix failed, report failures
            logger.warn({ prNumber }, 'Auto-fix failed, reporting to humans');
            await reportCIFailures(context, prNumber, checkResults);
          }
        } else {
          // No auto-fix or already tried
          await reportCIFailures(context, prNumber, checkResults);
        }
      } else {
        logger.info({ prNumber, status }, '✅ CI checks completed successfully');
      }
      
      // Clean up stored tests
      testContextStore.delete(prNumber);
      
    } catch (error) {
      logger.error({ error, prNumber }, 'Failed to check CI status');
    }
  };

  // Start monitoring after a delay to allow CI to start
  setTimeout(monitor, 60000); // Wait 1 minute before first check
}

// =============================================================================
// Summary Formatter
// =============================================================================

export function formatAutonomousExecutionSummary(
  result: AutonomousExecutionResult
): string {
  const lines: string[] = ['### 🤖 Autonomous Execution', ''];

  if (result.testsGenerated.length > 0) {
    lines.push(`✅ **Generated ${result.testsGenerated.length} test file(s)**`);
    lines.push('');
    lines.push('| File | Framework | Type |');
    lines.push('|------|-----------|------|');
    for (const test of result.testsGenerated) {
      lines.push(`| \`${test.filename}\` | ${test.framework} | ${test.type} |`);
    }
    lines.push('');
  }

  if (result.testPR) {
    lines.push(`✅ **Created Test PR:** [#${result.testPR.number}](${result.testPR.url})`);
    lines.push(`   - Branch: \`${result.testPR.branch}\``);
    lines.push('');
  }

  if (result.ciStatus) {
    const statusEmoji = result.ciStatus === 'success' ? '✅' : 
                        result.ciStatus === 'failure' ? '❌' : '⏳';
    lines.push(`${statusEmoji} **CI Status:** ${result.ciStatus}`);
    lines.push('');
  }

  if (result.errors.length > 0) {
    lines.push('⚠️ **Errors:**');
    for (const error of result.errors) {
      lines.push(`- ${error}`);
    }
    lines.push('');
  }

  return lines.join('\n');
}
