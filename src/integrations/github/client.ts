import { Octokit } from '@octokit/rest';
import { createAppAuth } from '@octokit/auth-app';
import { Webhooks } from '@octokit/webhooks';
import { config, logger } from '../../config/index.js';
import type { PullRequestContext, WebhookPayload } from '../../core/types.js';

// =============================================================================
// Webhook Handler
// =============================================================================

export const webhooks = new Webhooks({
  secret: config.github.webhookSecret,
});

// =============================================================================
// Octokit Client Factory
// =============================================================================

export function createOctokitForInstallation(installationId: number): Octokit {
  return new Octokit({
    authStrategy: createAppAuth,
    auth: {
      appId: config.github.appId,
      privateKey: config.github.privateKey,
      installationId,
    },
  });
}

// =============================================================================
// PR Operations
// =============================================================================

export async function fetchPullRequestDiff(
  octokit: Octokit,
  owner: string,
  repo: string,
  pullNumber: number
): Promise<string> {
  const response = await octokit.pulls.get({
    owner,
    repo,
    pull_number: pullNumber,
    mediaType: {
      format: 'diff',
    },
  });

  return response.data as unknown as string;
}

export async function fetchPullRequestDetails(
  installationId: number,
  owner: string,
  repo: string,
  pullNumber: number
): Promise<{ title: string; body: string | null; diff: string }> {
  const octokit = createOctokitForInstallation(installationId);

  const [prResponse, diff] = await Promise.all([
    octokit.pulls.get({
      owner,
      repo,
      pull_number: pullNumber,
    }),
    fetchPullRequestDiff(octokit, owner, repo, pullNumber),
  ]);

  return {
    title: prResponse.data.title,
    body: prResponse.data.body,
    diff,
  };
}

export async function postComment(
  installationId: number,
  owner: string,
  repo: string,
  pullNumber: number,
  body: string
): Promise<void> {
  const octokit = createOctokitForInstallation(installationId);

  await octokit.issues.createComment({
    owner,
    repo,
    issue_number: pullNumber,
    body,
  });

  logger.info({ owner, repo, pullNumber }, 'Comment posted successfully');
}

// =============================================================================
// Risk Labels (Pilar 1 - Governança de Risco)
// =============================================================================

const RISK_LABEL_PREFIX = 'keelo:risk-';

const RISK_LABEL_COLORS: Record<string, string> = {
  critical: 'B60205',
  high: 'D93F0B',
  medium: 'FBCA04',
  low: '0E8A16',
};

const MERGE_LABEL_MAP: Record<string, { label: string; color: string }> = {
  merge_ok: { label: 'keelo:merge-ok', color: '0E8A16' },
  attention: { label: 'keelo:attention', color: 'FBCA04' },
  block: { label: 'keelo:block-merge', color: 'B60205' },
};

/**
 * Adds risk-level and merge-recommendation labels to a PR.
 * Removes any previous keelo risk/merge labels first.
 */
export async function applyRiskLabels(
  installationId: number,
  owner: string,
  repo: string,
  pullNumber: number,
  riskLevel: string,
  mergeRecommendation: string
): Promise<void> {
  const octokit = createOctokitForInstallation(installationId);

  try {
    // 1. Get existing labels on the PR
    const { data: existingLabels } = await octokit.issues.listLabelsOnIssue({
      owner,
      repo,
      issue_number: pullNumber,
    });

    // 2. Remove old keelo labels
    const oldKeeloLabels = existingLabels.filter(l => 
      l.name.startsWith('keelo:risk-') || l.name.startsWith('keelo:merge-') || l.name === 'keelo:attention' || l.name === 'keelo:block-merge'
    );
    for (const label of oldKeeloLabels) {
      try {
        await octokit.issues.removeLabel({
          owner,
          repo,
          issue_number: pullNumber,
          name: label.name,
        });
      } catch {
        // Label might already be removed, ignore
      }
    }

    // 3. Ensure new labels exist in the repo
    const riskLabelName = `${RISK_LABEL_PREFIX}${riskLevel}`;
    const riskLabelColor = RISK_LABEL_COLORS[riskLevel] || 'FBCA04';
    const mergeInfo = MERGE_LABEL_MAP[mergeRecommendation] || MERGE_LABEL_MAP.attention;

    await ensureLabelExists(octokit, owner, repo, riskLabelName, riskLabelColor, `Keelo risk level: ${riskLevel}`);
    await ensureLabelExists(octokit, owner, repo, mergeInfo.label, mergeInfo.color, `Keelo merge recommendation: ${mergeRecommendation}`);

    // 4. Add new labels
    await octokit.issues.addLabels({
      owner,
      repo,
      issue_number: pullNumber,
      labels: [riskLabelName, mergeInfo.label],
    });

    logger.info({ owner, repo, pullNumber, riskLevel, mergeRecommendation }, 'Risk labels applied to PR');
  } catch (error) {
    logger.warn({ error, owner, repo, pullNumber }, 'Failed to apply risk labels (non-blocking)');
  }
}

async function ensureLabelExists(
  octokit: Octokit,
  owner: string,
  repo: string,
  name: string,
  color: string,
  description: string
): Promise<void> {
  try {
    await octokit.issues.getLabel({ owner, repo, name });
  } catch {
    // Label doesn't exist, create it
    try {
      await octokit.issues.createLabel({ owner, repo, name, color, description });
    } catch {
      // Label might have been created by another process, ignore
    }
  }
}

// =============================================================================
// Webhook Parsing
// =============================================================================

export function parseWebhookPayload(payload: WebhookPayload): Partial<PullRequestContext> {
  return {
    owner: payload.repository.owner.login,
    repo: payload.repository.name,
    pullNumber: payload.number,
    title: payload.pull_request.title,
    body: payload.pull_request.body,
    action: payload.action,
    installationId: payload.installation?.id,
  };
}

export async function verifyWebhookSignature(
  payload: string,
  signature: string
): Promise<boolean> {
  try {
    return await webhooks.verify(payload, signature);
  } catch {
    return false;
  }
}
