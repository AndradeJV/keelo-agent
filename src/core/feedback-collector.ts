import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { logger, keeloConfig } from '../config/index.js';
import { createOctokitForInstallation } from '../integrations/github/client.js';
import type { PullRequestContext, AnalysisResult } from './types.js';

// =============================================================================
// Types
// =============================================================================

export interface FeedbackEntry {
  id: string;
  timestamp: string;
  repo: string;
  prNumber: number;
  
  // Original analysis context
  analysisId: string;
  overallRisk: string;
  scenarioCount: number;
  
  // Feedback data
  reactions: ReactionFeedback;
  comments: CommentFeedback[];
  prOutcome: PROutcome;
  
  // Learning metrics
  wasHelpful: boolean;
  adjustments: string[];
}

export interface ReactionFeedback {
  thumbsUp: number;
  thumbsDown: number;
  heart: number;
  confused: number;
  rocket: number;
  eyes: number;
}

export interface CommentFeedback {
  body: string;
  author: string;
  sentiment: 'positive' | 'negative' | 'neutral';
  keywords: string[];
}

export interface PROutcome {
  merged: boolean;
  mergedAt?: string;
  closedWithoutMerge: boolean;
  testsAdded: boolean;
  issuesCreated: number;
}

export interface FeedbackStats {
  totalAnalyses: number;
  positiveReactions: number;
  negativeReactions: number;
  helpfulPercentage: number;
  commonKeywords: { keyword: string; count: number }[];
  riskAccuracy: { level: string; correct: number; total: number }[];
  topImprovements: string[];
}

export interface LearningInsights {
  shouldBeMoreConservative: boolean;
  shouldBeMoreAggressive: boolean;
  frequentFalsePositives: string[];
  frequentMisses: string[];
  promptAdjustments: string[];
}

// =============================================================================
// Storage
// =============================================================================

const FEEDBACK_DIR = join(process.cwd(), '.keelo-data');
const FEEDBACK_FILE = join(FEEDBACK_DIR, 'feedback-history.json');
const INSIGHTS_FILE = join(FEEDBACK_DIR, 'learning-insights.json');

function ensureDataDir(): void {
  if (!existsSync(FEEDBACK_DIR)) {
    mkdirSync(FEEDBACK_DIR, { recursive: true });
  }
}

function loadFeedbackHistory(): FeedbackEntry[] {
  ensureDataDir();
  if (!existsSync(FEEDBACK_FILE)) {
    return [];
  }
  try {
    const content = readFileSync(FEEDBACK_FILE, 'utf-8');
    return JSON.parse(content);
  } catch (error) {
    logger.error({ error }, 'Failed to load feedback history');
    return [];
  }
}

function saveFeedbackHistory(entries: FeedbackEntry[]): void {
  ensureDataDir();
  try {
    writeFileSync(FEEDBACK_FILE, JSON.stringify(entries, null, 2), 'utf-8');
  } catch (error) {
    logger.error({ error }, 'Failed to save feedback history');
  }
}

function loadInsights(): LearningInsights {
  ensureDataDir();
  if (!existsSync(INSIGHTS_FILE)) {
    return defaultInsights();
  }
  try {
    const content = readFileSync(INSIGHTS_FILE, 'utf-8');
    return JSON.parse(content);
  } catch {
    return defaultInsights();
  }
}

function saveInsights(insights: LearningInsights): void {
  ensureDataDir();
  try {
    writeFileSync(INSIGHTS_FILE, JSON.stringify(insights, null, 2), 'utf-8');
  } catch (error) {
    logger.error({ error }, 'Failed to save learning insights');
  }
}

function defaultInsights(): LearningInsights {
  return {
    shouldBeMoreConservative: false,
    shouldBeMoreAggressive: false,
    frequentFalsePositives: [],
    frequentMisses: [],
    promptAdjustments: [],
  };
}

// =============================================================================
// Feedback Collection
// =============================================================================

export async function collectFeedback(
  context: PullRequestContext,
  analysis: AnalysisResult,
  commentId: number
): Promise<FeedbackEntry | null> {
  const octokit = createOctokitForInstallation(context.installationId);

  try {
    // Get reactions on the comment
    const reactionsResponse = await octokit.reactions.listForIssueComment({
      owner: context.owner,
      repo: context.repo,
      comment_id: commentId,
    });

    const reactions: ReactionFeedback = {
      thumbsUp: 0,
      thumbsDown: 0,
      heart: 0,
      confused: 0,
      rocket: 0,
      eyes: 0,
    };

    for (const reaction of reactionsResponse.data) {
      switch (reaction.content) {
        case '+1': reactions.thumbsUp++; break;
        case '-1': reactions.thumbsDown++; break;
        case 'heart': reactions.heart++; break;
        case 'confused': reactions.confused++; break;
        case 'rocket': reactions.rocket++; break;
        case 'eyes': reactions.eyes++; break;
      }
    }

    // Get PR outcome
    const prResponse = await octokit.pulls.get({
      owner: context.owner,
      repo: context.repo,
      pull_number: context.pullNumber,
    });

    const prOutcome: PROutcome = {
      merged: prResponse.data.merged,
      mergedAt: prResponse.data.merged_at || undefined,
      closedWithoutMerge: prResponse.data.state === 'closed' && !prResponse.data.merged,
      testsAdded: false, // Would need to check commits
      issuesCreated: 0, // Would need to track
    };

    // Analyze if feedback was helpful
    const wasHelpful = 
      reactions.thumbsUp > reactions.thumbsDown ||
      reactions.heart > 0 ||
      reactions.rocket > 0;

    const entry: FeedbackEntry = {
      id: `${context.owner}/${context.repo}#${context.pullNumber}-${Date.now()}`,
      timestamp: new Date().toISOString(),
      repo: `${context.owner}/${context.repo}`,
      prNumber: context.pullNumber,
      analysisId: analysis.analyzedAt,
      overallRisk: analysis.overallRisk,
      scenarioCount: analysis.scenarios.length,
      reactions,
      comments: [],
      prOutcome,
      wasHelpful,
      adjustments: [],
    };

    // Save to history
    const history = loadFeedbackHistory();
    history.push(entry);
    
    // Keep only last 1000 entries
    if (history.length > 1000) {
      history.splice(0, history.length - 1000);
    }
    
    saveFeedbackHistory(history);

    logger.info({
      prNumber: context.pullNumber,
      reactions: reactions.thumbsUp - reactions.thumbsDown,
      wasHelpful,
    }, 'Feedback collected');

    return entry;
  } catch (error) {
    logger.error({ error }, 'Failed to collect feedback');
    return null;
  }
}

// =============================================================================
// Feedback Analysis
// =============================================================================

export function analyzeFeedback(): FeedbackStats {
  const history = loadFeedbackHistory();

  if (history.length === 0) {
    return {
      totalAnalyses: 0,
      positiveReactions: 0,
      negativeReactions: 0,
      helpfulPercentage: 0,
      commonKeywords: [],
      riskAccuracy: [],
      topImprovements: [],
    };
  }

  let positiveReactions = 0;
  let negativeReactions = 0;
  let helpfulCount = 0;
  const keywordCounts: Record<string, number> = {};
  const riskStats: Record<string, { correct: number; total: number }> = {};

  for (const entry of history) {
    positiveReactions += entry.reactions.thumbsUp + entry.reactions.heart + entry.reactions.rocket;
    negativeReactions += entry.reactions.thumbsDown + entry.reactions.confused;
    
    if (entry.wasHelpful) {
      helpfulCount++;
    }

    // Track risk accuracy
    if (!riskStats[entry.overallRisk]) {
      riskStats[entry.overallRisk] = { correct: 0, total: 0 };
    }
    riskStats[entry.overallRisk].total++;
    
    // Consider it "correct" if PR was merged without issues
    if (entry.prOutcome.merged && !entry.reactions.confused) {
      riskStats[entry.overallRisk].correct++;
    }

    // Extract keywords from comments
    for (const comment of entry.comments) {
      for (const keyword of comment.keywords) {
        keywordCounts[keyword] = (keywordCounts[keyword] || 0) + 1;
      }
    }
  }

  return {
    totalAnalyses: history.length,
    positiveReactions,
    negativeReactions,
    helpfulPercentage: (helpfulCount / history.length) * 100,
    commonKeywords: Object.entries(keywordCounts)
      .map(([keyword, count]) => ({ keyword, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10),
    riskAccuracy: Object.entries(riskStats)
      .map(([level, stats]) => ({ level, ...stats })),
    topImprovements: identifyImprovements(history),
  };
}

function identifyImprovements(history: FeedbackEntry[]): string[] {
  const improvements: string[] = [];
  
  // Check for patterns in negative feedback
  const negativeEntries = history.filter(e => 
    e.reactions.thumbsDown > e.reactions.thumbsUp || e.reactions.confused > 0
  );

  if (negativeEntries.length > history.length * 0.3) {
    improvements.push('Alta taxa de feedback negativo - revisar critérios de análise');
  }

  // Check risk distribution
  const riskCounts: Record<string, number> = {};
  for (const entry of history) {
    riskCounts[entry.overallRisk] = (riskCounts[entry.overallRisk] || 0) + 1;
  }

  if (riskCounts['critical'] && riskCounts['critical'] > history.length * 0.5) {
    improvements.push('Muitas análises marcadas como críticas - pode estar sendo muito conservador');
  }

  if (riskCounts['low'] && riskCounts['low'] > history.length * 0.8) {
    improvements.push('Poucas análises com riscos altos - pode estar perdendo problemas');
  }

  return improvements;
}

// =============================================================================
// Learning & Prompt Enhancement
// =============================================================================

export function generateLearningInsights(): LearningInsights {
  const stats = analyzeFeedback();
  const insights = loadInsights();

  // Analyze if we should adjust
  if (stats.totalAnalyses < 10) {
    return insights; // Not enough data
  }

  // Check if we're too conservative
  const criticalAccuracy = stats.riskAccuracy.find(r => r.level === 'critical');
  if (criticalAccuracy && criticalAccuracy.total > 0) {
    const accuracy = criticalAccuracy.correct / criticalAccuracy.total;
    if (accuracy < 0.5) {
      insights.shouldBeMoreAggressive = false;
      insights.shouldBeMoreConservative = false;
      insights.promptAdjustments.push(
        'Reduzir sensibilidade para riscos críticos - muitos falsos positivos'
      );
    }
  }

  // Check if we're missing issues
  if (stats.negativeReactions > stats.positiveReactions * 0.5) {
    insights.promptAdjustments.push(
      'Revisar heurísticas de detecção - feedback negativo alto'
    );
  }

  // Save updated insights
  saveInsights(insights);

  return insights;
}

export function getPromptEnhancements(): string[] {
  const insights = loadInsights();
  const enhancements: string[] = [];

  if (insights.shouldBeMoreConservative) {
    enhancements.push('Seja mais conservador nas avaliações de risco.');
  }

  if (insights.shouldBeMoreAggressive) {
    enhancements.push('Seja mais rigoroso na identificação de problemas.');
  }

  if (insights.frequentFalsePositives.length > 0) {
    enhancements.push(
      `Evite falsos positivos em: ${insights.frequentFalsePositives.join(', ')}`
    );
  }

  if (insights.frequentMisses.length > 0) {
    enhancements.push(
      `Preste mais atenção a: ${insights.frequentMisses.join(', ')}`
    );
  }

  return enhancements;
}

// =============================================================================
// Feedback Buttons in Comment
// =============================================================================

export function generateFeedbackSection(): string {
  return `
---

<details>
<summary>📊 <b>Feedback</b> - Ajude a melhorar o Keelo!</summary>

Reaja a este comentário para nos ajudar a melhorar:
- 👍 Análise útil e precisa
- 👎 Análise imprecisa ou pouco útil
- ❤️ Cenários de teste valiosos
- 🚀 Excelente identificação de riscos
- 😕 Algo confuso ou incorreto

Seu feedback é usado para aprendizado contínuo!

</details>
`;
}

// =============================================================================
// Stats Formatting
// =============================================================================

export function formatFeedbackStats(): string {
  const stats = analyzeFeedback();
  
  if (stats.totalAnalyses === 0) {
    return '';
  }

  const lines = ['### 📈 Estatísticas de Feedback', ''];
  
  lines.push(`| Métrica | Valor |`);
  lines.push(`|---------|-------|`);
  lines.push(`| Total de Análises | ${stats.totalAnalyses} |`);
  lines.push(`| Taxa de Utilidade | ${stats.helpfulPercentage.toFixed(1)}% |`);
  lines.push(`| Reações Positivas | ${stats.positiveReactions} |`);
  lines.push(`| Reações Negativas | ${stats.negativeReactions} |`);
  lines.push('');

  if (stats.topImprovements.length > 0) {
    lines.push('#### 🎯 Áreas de Melhoria');
    for (const improvement of stats.topImprovements) {
      lines.push(`- ${improvement}`);
    }
    lines.push('');
  }

  return lines.join('\n');
}

// =============================================================================
// Scheduled Feedback Collection
// =============================================================================

export async function collectPendingFeedback(
  context: PullRequestContext,
  commentId: number
): Promise<void> {
  // This would be called periodically (e.g., 24h after posting)
  // to collect reactions and update learning
  
  const history = loadFeedbackHistory();
  const existingEntry = history.find(e => 
    e.repo === `${context.owner}/${context.repo}` && 
    e.prNumber === context.pullNumber
  );

  if (existingEntry) {
    // Update with latest feedback
    try {
      const octokit = createOctokitForInstallation(context.installationId);
      
      const reactionsResponse = await octokit.reactions.listForIssueComment({
        owner: context.owner,
        repo: context.repo,
        comment_id: commentId,
      });

      existingEntry.reactions = {
        thumbsUp: 0,
        thumbsDown: 0,
        heart: 0,
        confused: 0,
        rocket: 0,
        eyes: 0,
      };

      for (const reaction of reactionsResponse.data) {
        switch (reaction.content) {
          case '+1': existingEntry.reactions.thumbsUp++; break;
          case '-1': existingEntry.reactions.thumbsDown++; break;
          case 'heart': existingEntry.reactions.heart++; break;
          case 'confused': existingEntry.reactions.confused++; break;
          case 'rocket': existingEntry.reactions.rocket++; break;
          case 'eyes': existingEntry.reactions.eyes++; break;
        }
      }

      existingEntry.wasHelpful = 
        existingEntry.reactions.thumbsUp > existingEntry.reactions.thumbsDown ||
        existingEntry.reactions.heart > 0 ||
        existingEntry.reactions.rocket > 0;

      saveFeedbackHistory(history);

      // Update learning insights
      generateLearningInsights();

      logger.info({
        prNumber: context.pullNumber,
        wasHelpful: existingEntry.wasHelpful,
      }, 'Feedback updated');
    } catch (error) {
      logger.error({ error }, 'Failed to update feedback');
    }
  }
}

