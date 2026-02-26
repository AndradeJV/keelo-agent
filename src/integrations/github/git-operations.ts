import { config, logger } from '../../config/index.js';
import { createOctokitForInstallation } from './client.js';
import type { PullRequestContext } from '../../core/types.js';
import type { GeneratedTest } from '../../core/test-generator.js';

// =============================================================================
// Types
// =============================================================================

export interface CommitResult {
  sha: string;
  branch: string;
  filesCommitted: string[];
}

export interface BranchInfo {
  name: string;
  sha: string;
}

// =============================================================================
// Branch Operations
// =============================================================================

export async function createBranch(
  context: PullRequestContext,
  branchName: string,
  baseSha: string
): Promise<BranchInfo> {
  const octokit = createOctokitForInstallation(context.installationId);

  try {
    // Check if branch already exists
    try {
      const existing = await octokit.git.getRef({
        owner: context.owner,
        repo: context.repo,
        ref: `heads/${branchName}`,
      });
      
      logger.info({ branch: branchName }, 'Branch already exists, will update');
      return { name: branchName, sha: existing.data.object.sha };
    } catch {
      // Branch doesn't exist, create it
    }

    const response = await octokit.git.createRef({
      owner: context.owner,
      repo: context.repo,
      ref: `refs/heads/${branchName}`,
      sha: baseSha,
    });

    logger.info({ branch: branchName, sha: response.data.object.sha }, 'Branch created');

    return {
      name: branchName,
      sha: response.data.object.sha,
    };
  } catch (error) {
    logger.error({ error, branch: branchName }, 'Failed to create branch');
    throw error;
  }
}

export async function getDefaultBranch(
  context: PullRequestContext
): Promise<{ name: string; sha: string }> {
  const octokit = createOctokitForInstallation(context.installationId);

  const repo = await octokit.repos.get({
    owner: context.owner,
    repo: context.repo,
  });

  const defaultBranch = repo.data.default_branch;

  const ref = await octokit.git.getRef({
    owner: context.owner,
    repo: context.repo,
    ref: `heads/${defaultBranch}`,
  });

  return {
    name: defaultBranch,
    sha: ref.data.object.sha,
  };
}

export async function getPRHeadSha(
  context: PullRequestContext
): Promise<string> {
  const octokit = createOctokitForInstallation(context.installationId);

  const pr = await octokit.pulls.get({
    owner: context.owner,
    repo: context.repo,
    pull_number: context.pullNumber,
  });

  return pr.data.head.sha;
}

// =============================================================================
// File Operations
// =============================================================================

export async function commitTestFiles(
  context: PullRequestContext,
  branchName: string,
  tests: GeneratedTest[],
  testOutputDir: string
): Promise<CommitResult> {
  const octokit = createOctokitForInstallation(context.installationId);

  // Get the current commit SHA of the branch
  const branchRef = await octokit.git.getRef({
    owner: context.owner,
    repo: context.repo,
    ref: `heads/${branchName}`,
  });
  const currentSha = branchRef.data.object.sha;

  // Get the current tree
  const currentCommit = await octokit.git.getCommit({
    owner: context.owner,
    repo: context.repo,
    commit_sha: currentSha,
  });
  const baseTree = currentCommit.data.tree.sha;

  // Create blobs for each test file
  const treeItems = await Promise.all(
    tests.map(async (test) => {
      const blob = await octokit.git.createBlob({
        owner: context.owner,
        repo: context.repo,
        content: Buffer.from(test.code).toString('base64'),
        encoding: 'base64',
      });

      const path = `${testOutputDir}/${test.filename}`.replace(/^\//, '');

      return {
        path,
        mode: '100644' as const,
        type: 'blob' as const,
        sha: blob.data.sha,
      };
    })
  );

  // Create new tree
  const newTree = await octokit.git.createTree({
    owner: context.owner,
    repo: context.repo,
    base_tree: baseTree,
    tree: treeItems,
  });

  // Create commit
  const commitMessage = `🧪 Keelo: Add automated tests for PR #${context.pullNumber}

Generated ${tests.length} test file(s):
${tests.map(t => `- ${t.filename} (${t.framework})`).join('\n')}

Triggered by: ${context.title}`;

  const newCommit = await octokit.git.createCommit({
    owner: context.owner,
    repo: context.repo,
    message: commitMessage,
    tree: newTree.data.sha,
    parents: [currentSha],
  });

  // Update branch reference
  await octokit.git.updateRef({
    owner: context.owner,
    repo: context.repo,
    ref: `heads/${branchName}`,
    sha: newCommit.data.sha,
  });

  logger.info({ 
    sha: newCommit.data.sha, 
    filesCount: tests.length,
    branch: branchName 
  }, 'Tests committed successfully');

  return {
    sha: newCommit.data.sha,
    branch: branchName,
    filesCommitted: tests.map(t => `${testOutputDir}/${t.filename}`),
  };
}

// =============================================================================
// Utility
// =============================================================================

export function generateTestBranchName(prNumber: number): string {
  const timestamp = Date.now();
  return `keelo/tests-pr-${prNumber}-${timestamp}`;
}
