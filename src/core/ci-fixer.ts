import { logger, keeloConfig } from '../config/index.js';
import { callLLM } from './llm.js';
import { createOctokitForInstallation } from '../integrations/github/client.js';
import { commitTestFiles } from '../integrations/github/git-operations.js';
import { sendSlackNotification } from '../integrations/slack/index.js';
import type { PullRequestContext } from './types.js';
import type { GeneratedTest } from './test-generator.js';
import type { CheckStatus } from '../integrations/github/pr-creator.js';
import { randomUUID } from 'crypto';

// =============================================================================
// Types
// =============================================================================

export interface CIFailureInfo {
  checkName: string;
  logs: string;
  errorMessage?: string;
  failedTests?: string[];
}

export interface FixAttempt {
  attempt: number;
  fix: GeneratedTest | null;
  success: boolean;
  error?: string;
}

export interface AutoFixResult {
  success: boolean;
  attempts: FixAttempt[];
  finalStatus: 'fixed' | 'needs_human' | 'unfixable';
  message: string;
}

// =============================================================================
// Constants
// =============================================================================

const MAX_FIX_ATTEMPTS = 3;

// =============================================================================
// Main Auto-Fix Function
// =============================================================================

export async function attemptAutoFix(
  context: PullRequestContext,
  testPRNumber: number,
  failedChecks: CheckStatus[],
  originalTests: GeneratedTest[]
): Promise<AutoFixResult> {
  const result: AutoFixResult = {
    success: false,
    attempts: [],
    finalStatus: 'needs_human',
    message: '',
  };

  logger.info({ 
    pr: testPRNumber, 
    failedChecks: failedChecks.length 
  }, '🔧 Starting auto-fix process');

  for (let attempt = 1; attempt <= MAX_FIX_ATTEMPTS; attempt++) {
    logger.info({ attempt, maxAttempts: MAX_FIX_ATTEMPTS }, `Auto-fix attempt ${attempt}`);

    try {
      // Step 1: Get failure logs
      const failureInfo = await getCIFailureLogs(context, testPRNumber, failedChecks);
      
      if (!failureInfo || failureInfo.length === 0) {
        logger.warn('No failure logs available, cannot auto-fix');
        result.finalStatus = 'unfixable';
        result.message = 'Could not retrieve CI logs';
        break;
      }

      // Step 2: Analyze and generate fix
      const fix = await generateFix(failureInfo, originalTests);
      
      if (!fix) {
        result.attempts.push({
          attempt,
          fix: null,
          success: false,
          error: 'Could not generate fix',
        });
        continue;
      }

      // Step 3: Apply fix (commit to PR branch)
      await applyFix(context, testPRNumber, fix);
      
      result.attempts.push({
        attempt,
        fix,
        success: true,
      });

      // Step 4: Wait for CI to run again
      logger.info({ attempt }, 'Fix applied, waiting for CI to re-run...');
      
      // We return here - the CI monitoring will pick up the new status
      result.success = true;
      result.finalStatus = 'fixed';
      result.message = `Fix applied on attempt ${attempt}. CI will re-run.`;
      
      // Notify success
      await notifyAutoFixResult(context, testPRNumber, attempt, true);
      
      return result;

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error({ error, attempt }, 'Auto-fix attempt failed');
      
      result.attempts.push({
        attempt,
        fix: null,
        success: false,
        error: errorMessage,
      });
    }
  }

  // All attempts failed
  result.finalStatus = 'needs_human';
  result.message = `Auto-fix failed after ${MAX_FIX_ATTEMPTS} attempts. Human intervention required.`;
  
  // Notify failure
  await notifyAutoFixResult(context, testPRNumber, MAX_FIX_ATTEMPTS, false);
  
  return result;
}

// =============================================================================
// Get CI Failure Logs
// =============================================================================

async function getCIFailureLogs(
  context: PullRequestContext,
  prNumber: number,
  failedChecks: CheckStatus[]
): Promise<CIFailureInfo[]> {
  const octokit = createOctokitForInstallation(context.installationId);
  const failures: CIFailureInfo[] = [];

  // Get the PR to find head SHA
  const pr = await octokit.pulls.get({
    owner: context.owner,
    repo: context.repo,
    pull_number: prNumber,
  });

  const headSha = pr.data.head.sha;

  // Get detailed check runs
  const checkRuns = await octokit.checks.listForRef({
    owner: context.owner,
    repo: context.repo,
    ref: headSha,
  });

  for (const check of failedChecks) {
    const checkRun = checkRuns.data.check_runs.find(r => r.name === check.name);
    
    if (!checkRun) continue;

    // Try to get logs from annotations
    let logs = '';
    let errorMessage = '';
    const failedTests: string[] = [];

    // Get annotations (test failures often show up here)
    if (checkRun.output?.annotations_count && checkRun.output.annotations_count > 0) {
      try {
        const annotations = await octokit.checks.listAnnotations({
          owner: context.owner,
          repo: context.repo,
          check_run_id: checkRun.id,
        });

        for (const annotation of annotations.data) {
          logs += `${annotation.path}:${annotation.start_line}: ${annotation.message}\n`;
          if (annotation.annotation_level === 'failure') {
            failedTests.push(annotation.path);
          }
        }
      } catch (error) {
        logger.warn({ error, check: check.name }, 'Failed to get annotations');
      }
    }

    // Get output summary if available
    if (checkRun.output?.summary) {
      logs += '\n\nSummary:\n' + checkRun.output.summary;
    }

    if (checkRun.output?.text) {
      logs += '\n\nDetails:\n' + checkRun.output.text;
    }

    // Try to get workflow run logs for GitHub Actions
    try {
      const workflowRuns = await octokit.actions.listWorkflowRunsForRepo({
        owner: context.owner,
        repo: context.repo,
        head_sha: headSha,
      });

      for (const run of workflowRuns.data.workflow_runs) {
        if (run.conclusion === 'failure') {
          // Get jobs for this workflow run
          const jobs = await octokit.actions.listJobsForWorkflowRun({
            owner: context.owner,
            repo: context.repo,
            run_id: run.id,
          });

          for (const job of jobs.data.jobs) {
            if (job.conclusion === 'failure') {
              // Try to download logs
              try {
                const logResponse = await octokit.actions.downloadJobLogsForWorkflowRun({
                  owner: context.owner,
                  repo: context.repo,
                  job_id: job.id,
                });
                
                // Logs come as a redirect, so we might get the URL or the content
                if (typeof logResponse.data === 'string') {
                  logs += '\n\nJob Logs:\n' + logResponse.data.slice(-5000); // Last 5000 chars
                }
              } catch (logError) {
                logger.debug({ error: logError, jobId: job.id }, 'Could not download job logs');
              }
            }
          }
        }
      }
    } catch (error) {
      logger.debug({ error }, 'Could not get workflow run logs');
    }

    // Extract error message from logs
    const errorMatch = logs.match(/(?:Error|FAIL|error):\s*(.+?)(?:\n|$)/i);
    if (errorMatch) {
      errorMessage = errorMatch[1];
    }

    failures.push({
      checkName: check.name,
      logs: logs || 'No detailed logs available',
      errorMessage,
      failedTests: [...new Set(failedTests)],
    });
  }

  return failures;
}

// =============================================================================
// Generate Fix using LLM
// =============================================================================

async function generateFix(
  failures: CIFailureInfo[],
  originalTests: GeneratedTest[]
): Promise<GeneratedTest | null> {
  const failureContext = failures.map(f => `
Check: ${f.checkName}
Error: ${f.errorMessage || 'Unknown error'}
Failed Tests: ${f.failedTests?.join(', ') || 'Unknown'}
Logs:
${f.logs.slice(0, 3000)}
`).join('\n---\n');

  const originalTestsContext = originalTests.map(t => `
File: ${t.filename}
Framework: ${t.framework}
Code:
\`\`\`${t.type === 'e2e' ? 'typescript' : 'typescript'}
${t.code}
\`\`\`
`).join('\n');

  const systemPrompt = `You are an expert test engineer fixing failing automated tests.

Your task is to analyze CI failure logs and fix the test code.

Common issues to look for:
1. Incorrect selectors (elements not found)
2. Timing issues (need waitFor, longer timeouts)
3. API mock issues
4. Assertion errors (wrong expected values)
5. Import errors
6. Syntax errors

Respond with JSON:
{
  "canFix": true/false,
  "analysis": "Brief explanation of what's wrong",
  "fixedTest": {
    "filename": "path/to/test.spec.ts",
    "code": "// Complete fixed test code",
    "framework": "playwright|vitest|jest",
    "type": "e2e|unit|integration",
    "changes": ["List of changes made"]
  }
}

If you cannot fix the issue (e.g., requires human decision, infrastructure issue), set canFix to false.`;

  const userPrompt = `## CI Failures

${failureContext}

## Original Test Files

${originalTestsContext}

Analyze the failures and provide a fix.`;

  try {
    const response = await callLLM({
      systemPrompt,
      userPrompt,
      jsonMode: true,
      maxTokens: 8000,
    });

    const result = JSON.parse(response);

    if (!result.canFix || !result.fixedTest) {
      logger.info({ analysis: result.analysis }, 'LLM determined issue is unfixable');
      return null;
    }

    return {
      id: randomUUID(),
      filename: result.fixedTest.filename,
      code: result.fixedTest.code,
      framework: result.fixedTest.framework,
      type: result.fixedTest.type,
      dependencies: [],
    };

  } catch (error) {
    logger.error({ error }, 'Failed to generate fix with LLM');
    return null;
  }
}

// =============================================================================
// Apply Fix (Commit to PR)
// =============================================================================

async function applyFix(
  context: PullRequestContext,
  prNumber: number,
  fix: GeneratedTest
): Promise<void> {
  const octokit = createOctokitForInstallation(context.installationId);

  // Get the PR to find the branch
  const pr = await octokit.pulls.get({
    owner: context.owner,
    repo: context.repo,
    pull_number: prNumber,
  });

  const branchName = pr.data.head.ref;

  // Commit the fix
  await commitTestFiles(
    context,
    branchName,
    [fix],
    keeloConfig.testOutputDir
  );

  // Comment on the PR about the fix
  await octokit.issues.createComment({
    owner: context.owner,
    repo: context.repo,
    issue_number: prNumber,
    body: `## 🔧 Auto-Fix Applied

Keelo detected a CI failure and automatically applied a fix.

### Changes Made
- File: \`${fix.filename}\`
- Framework: ${fix.framework}

The CI will re-run automatically. If the fix doesn't work, I'll try again (up to 3 attempts).

---
*Auto-fixed by [Keelo](https://github.com/keelo) - Autonomous QA Agent*`,
  });

  logger.info({ prNumber, file: fix.filename }, 'Fix committed to PR');
}

// =============================================================================
// Notifications
// =============================================================================

async function notifyAutoFixResult(
  context: PullRequestContext,
  prNumber: number,
  attempts: number,
  success: boolean
): Promise<void> {
  const slackConfig = keeloConfig.notifications?.slack;
  
  if (!slackConfig?.enabled || !slackConfig?.webhookUrl) return;

  // Resolve webhook URL from environment if placeholder
  let webhookUrl = slackConfig.webhookUrl;
  if (webhookUrl.includes('${SLACK_WEBHOOK_URL}')) {
    webhookUrl = process.env.SLACK_WEBHOOK_URL || '';
  }
  
  if (!webhookUrl) return;

  const repository = `${context.owner}/${context.repo}`;
  const prUrl = `https://github.com/${repository}/pull/${prNumber}`;

  if (success) {
    await sendSlackNotification(webhookUrl, {
      text: `🔧 Auto-Fix Successful - ${repository}`,
      blocks: [
        {
          type: 'header',
          text: { type: 'plain_text', text: '🔧 Auto-Fix Successful', emoji: true },
        },
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: `Keelo automatically fixed failing tests in <${prUrl}|PR #${prNumber}> after ${attempts} attempt(s).`,
          },
        },
        {
          type: 'context',
          elements: [
            { type: 'mrkdwn', text: `*Repository:* ${repository}` },
          ],
        },
      ],
    });
  } else {
    await sendSlackNotification(webhookUrl, {
      text: `⚠️ Auto-Fix Failed - ${repository}`,
      blocks: [
        {
          type: 'header',
          text: { type: 'plain_text', text: '⚠️ Auto-Fix Failed - Human Needed', emoji: true },
        },
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: `Keelo could not fix the failing tests after ${attempts} attempts.\nPlease review <${prUrl}|PR #${prNumber}>.`,
          },
        },
        {
          type: 'context',
          elements: [
            { type: 'mrkdwn', text: `*Repository:* ${repository}` },
          ],
        },
      ],
    });
  }
}

// =============================================================================
// Format Summary
// =============================================================================

export function formatAutoFixSummary(result: AutoFixResult): string {
  const lines = ['### 🔧 Auto-Fix Status', ''];

  if (result.success) {
    lines.push(`✅ **Fix Applied Successfully**`);
    lines.push(`- Attempts: ${result.attempts.length}`);
  } else {
    lines.push(`❌ **Auto-Fix Failed**`);
    lines.push(`- Attempts: ${result.attempts.length}/${MAX_FIX_ATTEMPTS}`);
    lines.push(`- Status: ${result.finalStatus}`);
  }

  lines.push('');
  lines.push(result.message);

  if (result.attempts.length > 0) {
    lines.push('');
    lines.push('| Attempt | Result | Details |');
    lines.push('|---------|--------|---------|');
    for (const attempt of result.attempts) {
      const status = attempt.success ? '✅' : '❌';
      const details = attempt.error || (attempt.fix ? `Fixed ${attempt.fix.filename}` : 'No fix generated');
      lines.push(`| ${attempt.attempt} | ${status} | ${details} |`);
    }
  }

  return lines.join('\n');
}

