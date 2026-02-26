/**
 * GitHub Integration Module
 * 
 * All GitHub-related operations:
 * - Webhook handling
 * - PR operations (fetch, comment)
 * - Git operations (branch, commit, push)
 * - Issue/Task creation
 * - Pattern detection
 */

export {
  fetchPullRequestDetails,
  fetchPullRequestDiff,
  postComment,
  parseWebhookPayload,
  verifyWebhookSignature,
  applyRiskLabels,
  webhooks,
} from './client.js';

export {
  createBranch,
  commitTestFiles,
  getDefaultBranch,
  getPRHeadSha,
  generateTestBranchName,
  type CommitResult,
  type BranchInfo,
} from './git-operations.js';

export {
  createTestPullRequest,
  getPRChecksStatus,
  reportCIFailures,
  type CreatedPullRequest,
  type CheckStatus,
} from './pr-creator.js';

export {
  createIssuesFromAnalysis,
  createTasksFromAnalysis,
  formatIssuesSummary,
  type CreatedIssue,
  type IssueCreationResult,
} from './issue-creator.js';

export {
  detectTestPattern,
  formatPatternSummary,
  DEFAULT_POM_STRUCTURE,
  type TestPattern,
  type TestStructure,
  type TestExample,
} from './pattern-detector.js';

