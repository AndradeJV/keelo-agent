import { keeloConfig, logger } from '../../config/index.js';
import { createOctokitForInstallation } from './client.js';
import type { AnalysisResult, PullRequestContext, RiskLevel } from '../../core/types.js';
import type { Octokit } from '@octokit/rest';

// =============================================================================
// Types
// =============================================================================

export interface CreatedIssue {
  number: number;
  title: string;
  url: string;
  type: 'bug' | 'task' | 'test';
}

export interface IssueCreationResult {
  created: CreatedIssue[];
  failed: { title: string; error: string }[];
}

// =============================================================================
// Issue Creation
// =============================================================================

export async function createIssuesFromAnalysis(
  analysis: AnalysisResult,
  context: PullRequestContext
): Promise<IssueCreationResult> {
  const octokit = createOctokitForInstallation(context.installationId);
  const result: IssueCreationResult = { created: [], failed: [] };

  // Create issues for functional gaps
  for (const gap of analysis.gaps) {
    if (gap.severity === 'critical' || gap.severity === 'high') {
      try {
        const issue = await createGapIssue(octokit, context, gap);
        result.created.push(issue);
      } catch (error) {
        result.failed.push({ 
          title: gap.title, 
          error: error instanceof Error ? error.message : 'Unknown error' 
        });
      }
    }
  }

  // Create issues for high-risk areas
  for (const risk of analysis.risks) {
    if (risk.level === 'critical') {
      try {
        const issue = await createRiskIssue(octokit, context, risk);
        result.created.push(issue);
      } catch (error) {
        result.failed.push({ 
          title: risk.area, 
          error: error instanceof Error ? error.message : 'Unknown error' 
        });
      }
    }
  }

  logger.info({ 
    created: result.created.length, 
    failed: result.failed.length 
  }, 'Issue creation completed');

  return result;
}

async function createGapIssue(
  octokit: Octokit,
  context: PullRequestContext,
  gap: { title: string; severity: RiskLevel; recommendation: string }
): Promise<CreatedIssue> {
  const labels = [
    ...keeloConfig.actions.issueLabels,
    `priority:${gap.severity}`,
    'type:gap',
  ];

  const body = `## 🔍 Functional Gap Detected by Keelo

**Identified in PR:** #${context.pullNumber}
**Severity:** ${gap.severity.toUpperCase()}

### Description
${gap.title}

### Recommendation
${gap.recommendation}

---
*This issue was automatically created by [Keelo](https://github.com/keelo) - Autonomous QA Agent*
`;

  const response = await octokit.issues.create({
    owner: context.owner,
    repo: context.repo,
    title: `[Keelo] Gap: ${gap.title}`,
    body,
    labels,
  });

  logger.info({ issueNumber: response.data.number }, 'Gap issue created');

  return {
    number: response.data.number,
    title: gap.title,
    url: response.data.html_url,
    type: 'bug',
  };
}

function formatMitigationForIssue(mitigation: string | { preventive: string; detective: string; corrective: string }): string {
  if (typeof mitigation === 'string') {
    return mitigation;
  }
  
  const lines: string[] = [];
  if (mitigation.preventive) {
    lines.push(`**🔒 Preventivo:** ${mitigation.preventive}`);
  }
  if (mitigation.detective) {
    lines.push(`**🔍 Detectivo:** ${mitigation.detective}`);
  }
  if (mitigation.corrective) {
    lines.push(`**🔧 Corretivo:** ${mitigation.corrective}`);
  }
  return lines.join('\n');
}

async function createRiskIssue(
  octokit: Octokit,
  context: PullRequestContext,
  risk: { level: RiskLevel; area: string; description: string; mitigation: string | { preventive: string; detective: string; corrective: string } }
): Promise<CreatedIssue> {
  const labels = [
    ...keeloConfig.actions.issueLabels,
    `priority:${risk.level}`,
    'type:risk',
  ];

  const mitigationText = formatMitigationForIssue(risk.mitigation);

  const body = `## ⚠️ Critical Risk Detected by Keelo

**Identified in PR:** #${context.pullNumber}
**Risk Level:** ${risk.level.toUpperCase()}
**Area:** ${risk.area}

### Description
${risk.description}

### Recommended Mitigation
${mitigationText}

---
*This issue was automatically created by [Keelo](https://github.com/keelo) - Autonomous QA Agent*
`;

  const response = await octokit.issues.create({
    owner: context.owner,
    repo: context.repo,
    title: `[Keelo] Risk: ${risk.area}`,
    body,
    labels,
  });

  logger.info({ issueNumber: response.data.number }, 'Risk issue created');

  return {
    number: response.data.number,
    title: risk.area,
    url: response.data.html_url,
    type: 'bug',
  };
}

// =============================================================================
// Task Creation
// =============================================================================

export async function createTasksFromAnalysis(
  analysis: AnalysisResult,
  context: PullRequestContext
): Promise<IssueCreationResult> {
  const octokit = createOctokitForInstallation(context.installationId);
  const result: IssueCreationResult = { created: [], failed: [] };

  // Create tasks for test coverage recommendations
  const testTasks = [
    ...analysis.testCoverage.unit.map(t => ({ type: 'unit' as const, desc: t })),
    ...analysis.testCoverage.integration.map(t => ({ type: 'integration' as const, desc: t })),
    ...analysis.testCoverage.e2e.map(t => ({ type: 'e2e' as const, desc: t })),
  ];

  // Group and limit tasks
  const tasksToCreate = testTasks.slice(0, 5); // Limit to 5 tasks

  for (const task of tasksToCreate) {
    try {
      const issue = await createTestTask(octokit, context, task.type, task.desc);
      result.created.push(issue);
    } catch (error) {
      result.failed.push({ 
        title: task.desc, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      });
    }
  }

  logger.info({ 
    created: result.created.length, 
    failed: result.failed.length 
  }, 'Task creation completed');

  return result;
}

async function createTestTask(
  octokit: Octokit,
  context: PullRequestContext,
  testType: 'unit' | 'integration' | 'e2e',
  description: string
): Promise<CreatedIssue> {
  const labels = [
    ...keeloConfig.actions.issueLabels,
    'type:task',
    `test:${testType}`,
  ];

  const body = `## 🧪 Test Task Created by Keelo

**Related to PR:** #${context.pullNumber}
**Test Type:** ${testType.toUpperCase()}

### Description
${description}

### Acceptance Criteria
- [ ] Test is implemented
- [ ] Test passes locally
- [ ] Test is added to CI pipeline

---
*This task was automatically created by [Keelo](https://github.com/keelo) - Autonomous QA Agent*
`;

  const response = await octokit.issues.create({
    owner: context.owner,
    repo: context.repo,
    title: `[Keelo] Test: ${description.substring(0, 50)}...`,
    body,
    labels,
  });

  logger.info({ issueNumber: response.data.number }, 'Test task created');

  return {
    number: response.data.number,
    title: description,
    url: response.data.html_url,
    type: 'task',
  };
}

// =============================================================================
// Summary Formatting
// =============================================================================

export function formatIssuesSummary(result: IssueCreationResult): string {
  if (result.created.length === 0 && result.failed.length === 0) {
    return '';
  }

  const lines = ['### 📋 Created Issues & Tasks', ''];

  if (result.created.length > 0) {
    lines.push('| Type | Issue | Link |');
    lines.push('|------|-------|------|');
    for (const issue of result.created) {
      lines.push(`| ${issue.type} | ${issue.title} | [#${issue.number}](${issue.url}) |`);
    }
    lines.push('');
  }

  if (result.failed.length > 0) {
    lines.push('**Failed to create:**');
    for (const fail of result.failed) {
      lines.push(`- ${fail.title}: ${fail.error}`);
    }
  }

  return lines.join('\n');
}
