import { logger, getActions, isAutonomousEnabled, getSlackConfig, keeloConfig, isHybridMode } from '../config/index.js';
import { 
  fetchPullRequestDetails, 
  postComment, 
  parseWebhookPayload,
  createIssuesFromAnalysis,
  createTasksFromAnalysis,
  formatIssuesSummary,
  applyRiskLabels,
} from '../integrations/github/index.js';
import { notifySlack, sendActionReport, sendProductImpactNotification, type KeeloActionReport } from '../integrations/slack/index.js';
import { generateProductImpactReport } from './product-impact.js';
import { isDatabaseEnabled, createPRAnalysis, recordRisksFromAnalysis, findOrCreateRepository } from '../database/index.js';
import { emitAnalysisNew, emitAnalysisUpdate, emitNotification } from '../api/websocket.js';
import { analyzePullRequest } from './analyzer.js';
import { formatComment, formatErrorComment } from './formatter.js';
import { generateTests, formatTestSummary } from './test-generator.js';
import { executeAutonomously, formatAutonomousExecutionSummary } from './autonomous-executor.js';
import { analyzeCoverage, formatCoverageSection } from './coverage-analyzer.js';
import { analyzeDependencies, formatDependencySection } from './dependency-analyzer.js';
import { generateFeedbackSection, getPromptEnhancements } from './feedback-collector.js';
import { parseCommand, getHelpMessage } from './command-parser.js';
import type { PullRequestContext, WebhookPayload, AnalysisResult, IssueCommentPayload } from './types.js';
import type { AutonomousExecutionResult } from './autonomous-executor.js';
import type { CoverageAnalysisResult } from './coverage-analyzer.js';
import type { DependencyAnalysisResult } from './dependency-analyzer.js';

const SUPPORTED_ACTIONS = ['opened', 'synchronize', 'reopened'];

// Patterns to identify PRs created by Keelo (should be ignored to avoid infinite loops)
const KEELO_TITLE_PATTERNS = [
  /\[Keelo\]/i,              // [Keelo] anywhere in title
  /^🧪.*\[Keelo\]/,          // 🧪 [Keelo] prefix  
  /Automated tests for PR/i, // "Automated tests for PR" phrase
];

const KEELO_BRANCH_PATTERNS = [
  /^keelo\//i,               // keelo/* branches
  /keelo\/tests-pr-/i,       // Keelo test branch pattern
];

function isKeeloPR(title: string, branch?: string): boolean {
  // Check title patterns
  for (const pattern of KEELO_TITLE_PATTERNS) {
    if (pattern.test(title)) {
      return true;
    }
  }
  
  // Check branch name patterns
  if (branch) {
    for (const pattern of KEELO_BRANCH_PATTERNS) {
      if (pattern.test(branch)) {
        return true;
      }
    }
  }
  
  return false;
}

export async function handlePullRequestEvent(payload: WebhookPayload): Promise<void> {
  const prInfo = parseWebhookPayload(payload);
  
  const logContext = {
    owner: prInfo.owner,
    repo: prInfo.repo,
    pullNumber: prInfo.pullNumber,
    action: prInfo.action,
  };

  logger.info(logContext, 'Received pull_request event');

  // Check if action is supported
  if (!prInfo.action || !SUPPORTED_ACTIONS.includes(prInfo.action)) {
    logger.info({ action: prInfo.action }, 'Ignoring unsupported action');
    return;
  }

  // Check if this is a PR created by Keelo (ignore to avoid infinite loops)
  const prTitle = payload.pull_request?.title || '';
  const prBranch = payload.pull_request?.head?.ref || '';
  
  if (isKeeloPR(prTitle, prBranch)) {
    logger.info({ 
      ...logContext, 
      prTitle,
      prBranch,
    }, '🔄 Ignoring Keelo-generated PR (test PR should not be analyzed)');
    return;
  }

  // Validate installation ID
  if (!prInfo.installationId) {
    logger.error(logContext, 'Missing installation ID');
    throw new Error('Missing installation ID in webhook payload');
  }

  try {
    // Fetch PR details and diff
    logger.info(logContext, 'Fetching PR details');
    const prDetails = await fetchPullRequestDetails(
      prInfo.installationId,
      prInfo.owner!,
      prInfo.repo!,
      prInfo.pullNumber!
    );

    const context: PullRequestContext = {
      owner: prInfo.owner!,
      repo: prInfo.repo!,
      pullNumber: prInfo.pullNumber!,
      title: prDetails.title,
      body: prDetails.body,
      diff: prDetails.diff,
      action: prInfo.action!,
      installationId: prInfo.installationId,
    };

    const prUrl = `https://github.com/${context.owner}/${context.repo}/pull/${context.pullNumber}`;
    const repository = `${context.owner}/${context.repo}`;

    // Emit WebSocket event - analysis starting
    emitAnalysisNew({
      id: `temp-${Date.now()}`,
      type: 'pr',
      status: 'processing',
      repository,
      pr_number: context.pullNumber,
      feature_name: context.title,
    });

    // Extract changed files from diff
    const changedFiles = extractChangedFiles(prDetails.diff);

    // Analyze coverage (if enabled)
    let coverageResult: CoverageAnalysisResult | null = null;
    if (keeloConfig.coverage?.enabled !== false) {
      logger.info(logContext, 'Analyzing code coverage');
      coverageResult = await analyzeCoverage(context, changedFiles);
    }

    // Analyze dependencies
    logger.info(logContext, 'Analyzing dependencies');
    const dependencyResult = await analyzeDependencies(context, changedFiles, prDetails.diff);

    // Get learning enhancements for better analysis
    const promptEnhancements = getPromptEnhancements();
    
    // Analyze PR with LLM
    logger.info(logContext, 'Analyzing PR with LLM');
    const analysis = await analyzePullRequest(context, promptEnhancements);

    // Execute actions based on configuration
    const actionResults = await executeActions(analysis, context, logContext, coverageResult);

    // Format main comment
    let comment = formatComment(analysis, context);

    // Append coverage analysis
    if (coverageResult) {
      const coverageSection = formatCoverageSection(coverageResult);
      if (coverageSection) {
        comment += '\n\n' + coverageSection;
      }
    }

    // Append dependency analysis
    if (dependencyResult.hasChanges) {
      comment += '\n\n' + formatDependencySection(dependencyResult);
    }

    // Append action results to comment
    if (actionResults.testSummary) {
      comment += '\n\n' + actionResults.testSummary;
    }
    if (actionResults.issuesSummary) {
      comment += '\n\n' + actionResults.issuesSummary;
    }
    if (actionResults.autonomousSummary) {
      comment += '\n\n' + actionResults.autonomousSummary;
    }

    // Add feedback section
    comment += '\n\n' + generateFeedbackSection();

    // Post comment to PR
    logger.info(logContext, 'Posting comment to PR');
    await postComment(
      context.installationId,
      context.owner,
      context.repo,
      context.pullNumber,
      comment
    );

    // === PILAR 1: Apply risk labels to PR ===
    logger.info({
      ...logContext,
      riskScore: analysis.riskScore,
      mergeRecommendation: analysis.mergeRecommendation,
    }, 'Applying risk governance labels');
    await applyRiskLabels(
      context.installationId,
      context.owner,
      context.repo,
      context.pullNumber,
      analysis.overallRisk,
      analysis.mergeRecommendation
    );

    // Save to database if enabled
    let savedAnalysisId: string | undefined;
    let repositoryId: string | undefined;
    if (isDatabaseEnabled()) {
      try {
        // Get or create repository
        const repo = await findOrCreateRepository(
          context.owner,
          context.repo,
          context.installationId
        );
        repositoryId = repo?.id;

        savedAnalysisId = await createPRAnalysis(
          {
            owner: context.owner,
            repo: context.repo,
            pullNumber: context.pullNumber,
            title: context.title,
            installationId: context.installationId,
            triggerSource: 'auto',
          },
          analysis
        );
        logger.info({ ...logContext, analysisId: savedAnalysisId }, 'Analysis saved to database');

        // Record risks to hotspots tracking
        if (repositoryId && analysis.risks.length > 0) {
          await recordRisksFromAnalysis(
            repositoryId,
            context.pullNumber,
            analysis.risks,
            changedFiles
          );
          logger.debug({ ...logContext, risksCount: analysis.risks.length }, 'Risks recorded to hotspots');
        }
      } catch (dbError) {
        logger.error({ ...logContext, dbError }, 'Failed to save analysis to database');
      }
    }

    // Emit WebSocket event - analysis completed (with Pilar 1 data)
    emitAnalysisUpdate(
      savedAnalysisId || `temp-${context.pullNumber}`,
      {
        status: 'completed',
        overall_risk: analysis.overallRisk,
        risk_score: analysis.riskScore,
        merge_recommendation: analysis.mergeRecommendation,
        scenarios_count: analysis.scenarios.length,
        risks_count: analysis.risks.length,
        completed_at: new Date().toISOString(),
      },
      repository
    );

    // Emit notification for critical risks or blocked merges
    if (analysis.overallRisk === 'critical' || analysis.mergeRecommendation === 'block') {
      emitNotification({
        type: 'critical_risk',
        title: '🚫 Merge Bloqueado pelo Keelo',
        message: `PR #${context.pullNumber}: ${context.title} | Risk Score: ${analysis.riskScore}/100`,
        analysisId: savedAnalysisId,
        repository,
      });
    }

    // Send Slack notifications with comprehensive action report
    await sendSlackNotifications(analysis, context, prUrl, actionResults.autonomousResult, savedAnalysisId);

    logger.info({
      ...logContext,
      riskScore: analysis.riskScore,
      mergeRecommendation: analysis.mergeRecommendation,
    }, 'PR analysis completed successfully');
  } catch (error) {
    logger.error({ ...logContext, error }, 'Failed to process PR');

    // Emit WebSocket event - analysis failed
    const repository = prInfo.owner && prInfo.repo ? `${prInfo.owner}/${prInfo.repo}` : undefined;
    emitAnalysisUpdate(
      `temp-${prInfo.pullNumber || Date.now()}`,
      {
        status: 'failed',
        error_message: error instanceof Error ? error.message : 'Erro desconhecido',
      },
      repository
    );

    // Emit failure notification
    emitNotification({
      type: 'analysis_failed',
      title: '❌ Análise Falhou',
      message: prInfo.pullNumber ? `PR #${prInfo.pullNumber}` : 'Análise de PR',
      repository,
    });

    // Try to post error comment
    if (prInfo.installationId && prInfo.owner && prInfo.repo && prInfo.pullNumber) {
      try {
        const errorComment = formatErrorComment(error as Error);
        await postComment(
          prInfo.installationId,
          prInfo.owner,
          prInfo.repo,
          prInfo.pullNumber,
          errorComment
        );
      } catch (commentError) {
        logger.error({ ...logContext, commentError }, 'Failed to post error comment');
      }
    }

    throw error;
  }
}

// =============================================================================
// Silent/Hybrid PR Analysis (dashboard only - no PR comments)
// =============================================================================

/**
 * Analyzes a PR silently — results go to the database and WebSocket (dashboard)
 * but NO comments, labels, or actions are applied to the GitHub PR.
 * 
 * Used in "hybrid" trigger mode: all PRs are tracked in the dashboard,
 * while PR comments are only triggered on-demand via /keelo commands.
 */
export async function handleSilentPRAnalysis(payload: WebhookPayload): Promise<void> {
  const prInfo = parseWebhookPayload(payload);

  const logContext = {
    owner: prInfo.owner,
    repo: prInfo.repo,
    pullNumber: prInfo.pullNumber,
    action: prInfo.action,
    mode: 'silent',
  };

  logger.info(logContext, '🔇 Hybrid mode: starting silent PR analysis (dashboard only)');

  // Check if action is supported
  if (!prInfo.action || !SUPPORTED_ACTIONS.includes(prInfo.action)) {
    logger.info({ action: prInfo.action }, 'Ignoring unsupported action');
    return;
  }

  // Check if this is a PR created by Keelo (ignore to avoid infinite loops)
  const prTitle = payload.pull_request?.title || '';
  const prBranch = payload.pull_request?.head?.ref || '';

  if (isKeeloPR(prTitle, prBranch)) {
    logger.info({
      ...logContext,
      prTitle,
      prBranch,
    }, '🔄 Ignoring Keelo-generated PR');
    return;
  }

  // Validate installation ID
  if (!prInfo.installationId) {
    logger.error(logContext, 'Missing installation ID');
    throw new Error('Missing installation ID in webhook payload');
  }

  try {
    // Fetch PR details and diff
    logger.info(logContext, 'Fetching PR details (silent)');
    const prDetails = await fetchPullRequestDetails(
      prInfo.installationId,
      prInfo.owner!,
      prInfo.repo!,
      prInfo.pullNumber!
    );

    const context: PullRequestContext = {
      owner: prInfo.owner!,
      repo: prInfo.repo!,
      pullNumber: prInfo.pullNumber!,
      title: prDetails.title,
      body: prDetails.body,
      diff: prDetails.diff,
      action: prInfo.action!,
      installationId: prInfo.installationId,
    };

    const prUrl = `https://github.com/${context.owner}/${context.repo}/pull/${context.pullNumber}`;
    const repository = `${context.owner}/${context.repo}`;

    // Emit WebSocket event - analysis starting
    emitAnalysisNew({
      id: `temp-${Date.now()}`,
      type: 'pr',
      status: 'processing',
      repository,
      pr_number: context.pullNumber,
      feature_name: context.title,
    });

    // Extract changed files from diff
    const changedFiles = extractChangedFiles(prDetails.diff);

    // Analyze coverage (if enabled)
    let coverageResult: CoverageAnalysisResult | null = null;
    if (keeloConfig.coverage?.enabled !== false) {
      logger.info(logContext, 'Analyzing code coverage (silent)');
      coverageResult = await analyzeCoverage(context, changedFiles);
    }

    // Analyze dependencies
    logger.info(logContext, 'Analyzing dependencies (silent)');
    const dependencyResult = await analyzeDependencies(context, changedFiles, prDetails.diff);

    // Get learning enhancements
    const promptEnhancements = getPromptEnhancements();

    // Analyze PR with LLM
    logger.info(logContext, 'Analyzing PR with LLM (silent)');
    const analysis = await analyzePullRequest(context, promptEnhancements);

    // ========================================================================
    // SILENT MODE: Save to database + WebSocket only — NO GitHub interactions
    // ========================================================================

    // Save to database if enabled
    let savedAnalysisId: string | undefined;
    let repositoryId: string | undefined;
    if (isDatabaseEnabled()) {
      try {
        const repoRecord = await findOrCreateRepository(
          context.owner,
          context.repo,
          context.installationId
        );
        repositoryId = repoRecord?.id;

        savedAnalysisId = await createPRAnalysis(
          {
            owner: context.owner,
            repo: context.repo,
            pullNumber: context.pullNumber,
            title: context.title,
            installationId: context.installationId,
            triggerSource: 'silent',
          },
          analysis
        );
        logger.info({ ...logContext, analysisId: savedAnalysisId }, 'Silent analysis saved to database');

        // Record risks to hotspots tracking
        if (repositoryId && analysis.risks.length > 0) {
          await recordRisksFromAnalysis(
            repositoryId,
            context.pullNumber,
            analysis.risks,
            changedFiles
          );
        }
      } catch (dbError) {
        logger.error({ ...logContext, dbError }, 'Failed to save silent analysis to database');
      }
    }

    // Emit WebSocket event - analysis completed
    emitAnalysisUpdate(
      savedAnalysisId || `temp-${context.pullNumber}`,
      {
        status: 'completed',
        overall_risk: analysis.overallRisk,
        risk_score: analysis.riskScore,
        merge_recommendation: analysis.mergeRecommendation,
        scenarios_count: analysis.scenarios.length,
        risks_count: analysis.risks.length,
        completed_at: new Date().toISOString(),
      },
      repository
    );

    // Emit notification for critical risks
    if (analysis.overallRisk === 'critical' || analysis.mergeRecommendation === 'block') {
      emitNotification({
        type: 'critical_risk',
        title: '🚫 Risco Crítico Detectado (Monitoramento)',
        message: `PR #${context.pullNumber}: ${context.title} | Risk Score: ${analysis.riskScore}/100`,
        analysisId: savedAnalysisId,
        repository,
      });
    }

    // Send Slack notifications (silent analyses still notify Slack)
    await sendSlackNotifications(analysis, context, prUrl, undefined, savedAnalysisId);

    logger.info({
      ...logContext,
      analysisId: savedAnalysisId,
      riskScore: analysis.riskScore,
      mergeRecommendation: analysis.mergeRecommendation,
    }, '🔇 Silent PR analysis completed (dashboard only, no PR comment)');
  } catch (error) {
    logger.error({ ...logContext, error }, 'Failed to process silent PR analysis');

    // Emit WebSocket event - analysis failed
    const repository = prInfo.owner && prInfo.repo ? `${prInfo.owner}/${prInfo.repo}` : undefined;
    emitAnalysisUpdate(
      `temp-${prInfo.pullNumber || Date.now()}`,
      {
        status: 'failed',
        error_message: error instanceof Error ? error.message : 'Erro desconhecido',
      },
      repository
    );

    emitNotification({
      type: 'analysis_failed',
      title: '❌ Análise Silenciosa Falhou',
      message: prInfo.pullNumber ? `PR #${prInfo.pullNumber}` : 'Análise de PR',
      repository,
    });

    // In silent mode, do NOT post error comments to the PR
    throw error;
  }
}

// =============================================================================
// Command Handler (for /keelo commands in PR comments)
// =============================================================================

export async function handleCommentCommand(payload: IssueCommentPayload): Promise<void> {
  const logContext = {
    prNumber: payload.issue.number,
    owner: payload.repository.owner.login,
    repo: payload.repository.name,
    sender: payload.sender.login,
  };

  logger.info(logContext, 'Processing comment for Keelo commands');

  // Only process comments on PRs (not issues)
  if (!payload.issue.pull_request) {
    logger.debug(logContext, 'Ignoring comment on non-PR issue');
    return;
  }

  // Ignore bot comments to prevent loops
  if (payload.sender.type === 'Bot') {
    logger.debug(logContext, 'Ignoring bot comment');
    return;
  }

  // Parse command from comment body
  const command = parseCommand(payload.comment.body);
  if (!command) {
    logger.debug(logContext, 'No Keelo command found in comment');
    return;
  }

  logger.info({ ...logContext, command: command.type }, 'Keelo command detected');

  const installationId = payload.installation?.id;
  if (!installationId) {
    logger.error(logContext, 'Missing installation ID');
    return;
  }

  const owner = payload.repository.owner.login;
  const repo = payload.repository.name;
  const prNumber = payload.issue.number;

  try {
    switch (command.type) {
      case 'analyze':
        await runAnalysis(installationId, owner, repo, prNumber);
        break;
      
      case 'generate-tests':
        await runTestGeneration(installationId, owner, repo, prNumber);
        break;
      
      case 'help':
        await postComment(installationId, owner, repo, prNumber, getHelpMessage());
        break;
    }
  } catch (error) {
    logger.error({ ...logContext, error }, 'Failed to execute Keelo command');
    
    const errorMessage = `## ❌ Keelo - Erro

Falha ao executar o comando \`/keelo ${command.type}\`.

**Erro**: ${error instanceof Error ? error.message : 'Erro desconhecido'}

Por favor, tente novamente. Se o problema persistir, verifique os logs do servidor.`;

    try {
      await postComment(installationId, owner, repo, prNumber, errorMessage);
    } catch {
      logger.error(logContext, 'Failed to post error comment');
    }
  }
}

// =============================================================================
// Command: /keelo analyze
// =============================================================================

async function runAnalysis(
  installationId: number,
  owner: string,
  repo: string,
  prNumber: number
): Promise<void> {
  const logContext = { owner, repo, prNumber, command: 'analyze' };
  
  logger.info(logContext, '🔍 Starting PR analysis via command');

  // Post "thinking" reaction or comment
  const thinkingComment = `## 🔄 Keelo - Analisando PR...

Aguarde enquanto analiso os riscos, cenários de teste e gaps.

> Isso pode levar alguns segundos.`;

  await postComment(installationId, owner, repo, prNumber, thinkingComment);

  // Fetch PR details and diff
  const prDetails = await fetchPullRequestDetails(installationId, owner, repo, prNumber);

  const context: PullRequestContext = {
    owner,
    repo,
    pullNumber: prNumber,
    title: prDetails.title,
    body: prDetails.body,
    diff: prDetails.diff,
    action: 'command',
    installationId,
  };

  const prUrl = `https://github.com/${owner}/${repo}/pull/${prNumber}`;
  const repository = `${owner}/${repo}`;

  // Emit WebSocket event - analysis starting
  emitAnalysisNew({
    id: `temp-${Date.now()}`,
    type: 'pr',
    status: 'processing',
    repository,
    pr_number: prNumber,
    feature_name: context.title,
  });

  // Extract changed files from diff
  const changedFiles = extractChangedFiles(prDetails.diff);

  // Analyze coverage (if enabled)
  let coverageResult: CoverageAnalysisResult | null = null;
  if (keeloConfig.coverage?.enabled !== false) {
    logger.info(logContext, 'Analyzing code coverage');
    coverageResult = await analyzeCoverage(context, changedFiles);
  }

  // Analyze dependencies
  logger.info(logContext, 'Analyzing dependencies');
  const dependencyResult = await analyzeDependencies(context, changedFiles, prDetails.diff);

  // Get learning enhancements for better analysis
  const promptEnhancements = getPromptEnhancements();
  
  // Analyze PR with LLM
  logger.info(logContext, 'Analyzing PR with LLM');
  const analysis = await analyzePullRequest(context, promptEnhancements);

  // Format main comment (analysis only, no test generation)
  let comment = formatComment(analysis, context);

  // Append coverage analysis
  if (coverageResult) {
    const coverageSection = formatCoverageSection(coverageResult);
    if (coverageSection) {
      comment += '\n\n' + coverageSection;
    }
  }

  // Append dependency analysis
  if (dependencyResult.hasChanges) {
    comment += '\n\n' + formatDependencySection(dependencyResult);
  }

  // Add feedback section
  comment += '\n\n' + generateFeedbackSection();

  // Add command hint
  comment += `

---

> 💡 **Próximo passo**: Para gerar testes automatizados, comente \`/keelo generate tests\``;

  // Post comment to PR
  logger.info(logContext, 'Posting analysis comment to PR');
  await postComment(installationId, owner, repo, prNumber, comment);

  // === PILAR 1: Apply risk labels to PR (command mode) ===
  logger.info({
    ...logContext,
    riskScore: analysis.riskScore,
    mergeRecommendation: analysis.mergeRecommendation,
  }, 'Applying risk governance labels (command)');
  await applyRiskLabels(
    installationId,
    owner,
    repo,
    prNumber,
    analysis.overallRisk,
    analysis.mergeRecommendation
  );

  // Save to database if enabled
  let savedAnalysisId: string | undefined;
  let repositoryId: string | undefined;
  if (isDatabaseEnabled()) {
    try {
      const repoRecord = await findOrCreateRepository(owner, repo, installationId);
      repositoryId = repoRecord?.id;

      savedAnalysisId = await createPRAnalysis(
        { owner, repo, pullNumber: prNumber, title: context.title, installationId, triggerSource: 'command' },
        analysis
      );
      logger.info({ ...logContext, analysisId: savedAnalysisId }, 'Analysis saved to database');

      // Record risks to hotspots tracking
      if (repositoryId && analysis.risks.length > 0) {
        await recordRisksFromAnalysis(repositoryId, prNumber, analysis.risks, changedFiles);
      }
    } catch (dbError) {
      logger.error({ ...logContext, dbError }, 'Failed to save analysis to database');
    }
  }

  // Emit WebSocket event - analysis completed (with Pilar 1 data)
  emitAnalysisUpdate(
    savedAnalysisId || `temp-${prNumber}`,
    {
      status: 'completed',
      overall_risk: analysis.overallRisk,
      risk_score: analysis.riskScore,
      merge_recommendation: analysis.mergeRecommendation,
      scenarios_count: analysis.scenarios.length,
      risks_count: analysis.risks.length,
      completed_at: new Date().toISOString(),
    },
    repository
  );

  // Send Slack notification
  await sendSlackNotifications(analysis, context, prUrl, undefined, savedAnalysisId);

  logger.info(logContext, 'PR analysis completed successfully');
}

// =============================================================================
// Command: /keelo generate tests
// =============================================================================

async function runTestGeneration(
  installationId: number,
  owner: string,
  repo: string,
  prNumber: number
): Promise<void> {
  const logContext = { owner, repo, prNumber, command: 'generate-tests' };
  
  logger.info(logContext, '🧪 Starting test generation via command');

  // Post "thinking" comment
  const thinkingComment = `## 🔄 Keelo - Gerando Testes...

Aguarde enquanto gero os testes automatizados para este PR.

> Isso inclui análise do código, geração de testes e criação de PR.`;

  await postComment(installationId, owner, repo, prNumber, thinkingComment);

  // Fetch PR details and diff
  const prDetails = await fetchPullRequestDetails(installationId, owner, repo, prNumber);

  const context: PullRequestContext = {
    owner,
    repo,
    pullNumber: prNumber,
    title: prDetails.title,
    body: prDetails.body,
    diff: prDetails.diff,
    action: 'command',
    installationId,
  };

  // First, run analysis to get scenarios
  const changedFiles = extractChangedFiles(prDetails.diff);
  
  let coverageResult: CoverageAnalysisResult | null = null;
  if (keeloConfig.coverage?.enabled !== false) {
    coverageResult = await analyzeCoverage(context, changedFiles);
  }

  const promptEnhancements = getPromptEnhancements();
  const analysis = await analyzePullRequest(context, promptEnhancements);

  // Execute autonomous test generation (creates branch, commits, opens PR)
  if (isAutonomousEnabled()) {
    logger.info(logContext, '🤖 Executing autonomous test generation');
    
    const autonomousResult = await executeAutonomously(analysis, context);
    const summary = formatAutonomousExecutionSummary(autonomousResult);

    const resultComment = `## 🧪 Keelo - Testes Gerados

${summary}

---

> ✅ Os testes foram gerados e um PR foi criado automaticamente.`;

    await postComment(installationId, owner, repo, prNumber, resultComment);
  } else {
    // Non-autonomous mode: just generate and show tests
    logger.info(logContext, 'Generating tests (non-autonomous mode)');
    
    // Enhance analysis with coverage suggestions
    if (coverageResult?.found && coverageResult.suggestions.length > 0) {
      for (const suggestion of coverageResult.suggestions) {
        if (!analysis.testCoverage.unit.some(t => t.includes(suggestion.file))) {
          analysis.testCoverage.unit.push(`[Cobertura] ${suggestion.file}: ${suggestion.reason}`);
        }
      }
    }

    const testResult = await generateTests(analysis, context);
    const testSummary = formatTestSummary(testResult);

    const resultComment = `## 🧪 Keelo - Testes Sugeridos

${testSummary}

---

> ⚠️ **Modo não-autônomo**: Os testes acima são sugestões. Configure \`autonomous.enabled: true\` no \`.keelo.json\` para que o Keelo crie PRs automaticamente.`;

    await postComment(installationId, owner, repo, prNumber, resultComment);
  }

  logger.info(logContext, 'Test generation completed successfully');
}

// =============================================================================
// Utility Functions
// =============================================================================

function extractChangedFiles(diff: string): string[] {
  const files: string[] = [];
  const diffLines = diff.split('\n');
  
  for (const line of diffLines) {
    if (line.startsWith('diff --git')) {
      const match = line.match(/b\/(.+)$/);
      if (match) {
        files.push(match[1]);
      }
    }
  }
  
  return files;
}

// =============================================================================
// Slack Notifications
// =============================================================================

async function sendSlackNotifications(
  analysis: AnalysisResult,
  context: PullRequestContext,
  prUrl: string,
  autonomousResult?: AutonomousExecutionResult,
  analysisId?: string
): Promise<void> {
  const slackConfig = getSlackConfig();
  
  if (!slackConfig.enabled) return;

  const repository = `${context.owner}/${context.repo}`;

  try {
    // Build comprehensive action report
    const actionReport: KeeloActionReport = {
      repository,
      prNumber: context.pullNumber,
      prTitle: context.title,
      prUrl,
      analysisId,
      actions: {
        analyzed: true,
        testsGenerated: autonomousResult?.testsGenerated.length || 0,
        testPRCreated: autonomousResult?.testPR ? {
          number: autonomousResult.testPR.number,
          url: autonomousResult.testPR.url,
          branch: autonomousResult.testPR.branch,
        } : undefined,
        ciStatus: autonomousResult?.ciStatus,
        risksIdentified: analysis.risks.length,
        gapsFound: analysis.gaps.length,
      },
      overallRisk: analysis.overallRisk,
      scenariosCount: analysis.scenarios.length,
      dashboardUrl: analysisId 
        ? `${process.env.BASE_URL || 'http://localhost:3000'}/analyses/${analysisId}`
        : undefined,
    };

    // Send comprehensive action report
    await sendActionReport(slackConfig.webhookUrl, actionReport);

    // === PILAR 3: Send product impact notification ===
    try {
      const productReport = generateProductImpactReport(analysis, {
        analysisId,
        prNumber: context.pullNumber,
        repository,
      });

      await sendProductImpactNotification(slackConfig.webhookUrl, {
        analysisId: analysisId || `pr-${context.pullNumber}`,
        prNumber: context.pullNumber,
        repository,
        productHealthScore: productReport.productHealth.score,
        productHealthStatus: productReport.productHealth.status,
        mergeDecision: productReport.mergeDecision.label,
        mergeEmoji: productReport.mergeDecision.emoji,
        executiveSummary: productReport.executiveSummary,
        uxIssuesCount: productReport.uxImpact.length,
        criticalRisks: productReport.metricsSummary.criticalRisks,
        topRecommendations: productReport.recommendations
          .filter(r => r.priority === 'must-do' || r.priority === 'should-do')
          .map(r => r.title)
          .slice(0, 3),
        dashboardUrl: analysisId 
          ? `${process.env.BASE_URL || 'http://localhost:3000'}/product-insights/${analysisId}`
          : undefined,
      });
      logger.info({ analysisId, prNumber: context.pullNumber }, 'Product impact notification sent to Slack');
    } catch (pilar3Error) {
      logger.warn({ pilar3Error }, 'Failed to send product impact notification (non-critical)');
    }

    // Additionally notify about critical risks (for immediate attention)
    const hasCriticalRisks = analysis.risks.some(r => r.level === 'critical');
    if (hasCriticalRisks) {
      await notifySlack(slackConfig, 'criticalRisk', {
        analysis,
        context,
        prUrl,
      });
    }
  } catch (error) {
    logger.error({ error }, 'Failed to send Slack notifications');
  }
}

// =============================================================================
// Action Execution
// =============================================================================

interface ActionResults {
  testSummary?: string;
  issuesSummary?: string;
  autonomousSummary?: string;
  autonomousResult?: AutonomousExecutionResult;
}

async function executeActions(
  analysis: AnalysisResult,
  context: PullRequestContext,
  logContext: Record<string, unknown>,
  coverageResult: CoverageAnalysisResult | null
): Promise<ActionResults> {
  const actions = getActions();
  const results: ActionResults = {};

  // Enhance analysis with coverage suggestions
  if (coverageResult?.found && coverageResult.suggestions.length > 0) {
    // Add coverage-based test recommendations
    for (const suggestion of coverageResult.suggestions) {
      if (!analysis.testCoverage.unit.some(t => t.includes(suggestion.file))) {
        analysis.testCoverage.unit.push(
          `[Cobertura] ${suggestion.file}: ${suggestion.reason}`
        );
      }
    }
  }

  // Check if autonomous mode is enabled (Phase 3)
  if (isAutonomousEnabled()) {
    logger.info(logContext, '🤖 Autonomous execution mode enabled');
    
    try {
      const autonomousResult = await executeAutonomously(analysis, context);
      results.autonomousSummary = formatAutonomousExecutionSummary(autonomousResult);
      results.autonomousResult = autonomousResult;
      
      // Skip Phase 2 actions if autonomous mode handles them
      return results;
    } catch (error) {
      logger.error({ ...logContext, error }, 'Autonomous execution failed, falling back to Phase 2');
    }
  }

  // Phase 2: Generate tests (non-autonomous)
  if (actions.autoGenerateTests && !isAutonomousEnabled()) {
    logger.info(logContext, 'Auto-generating tests...');
    try {
      const testResult = await generateTests(analysis, context);
      results.testSummary = formatTestSummary(testResult);
    } catch (error) {
      logger.error({ ...logContext, error }, 'Failed to generate tests');
    }
  }

  // Phase 2: Create issues
  if (actions.autoCreateIssues) {
    logger.info(logContext, 'Auto-creating issues...');
    try {
      const issueResult = await createIssuesFromAnalysis(analysis, context);
      const taskResult = actions.autoCreateTasks 
        ? await createTasksFromAnalysis(analysis, context)
        : { created: [], failed: [] };

      const combinedResult = {
        created: [...issueResult.created, ...taskResult.created],
        failed: [...issueResult.failed, ...taskResult.failed],
      };

      results.issuesSummary = formatIssuesSummary(combinedResult);
    } catch (error) {
      logger.error({ ...logContext, error }, 'Failed to create issues');
    }
  }

  return results;
}
