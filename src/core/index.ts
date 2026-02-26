/**
 * Core Module
 * 
 * Business logic for:
 * - PR Analysis (LLM integration)
 * - Test Generation (POM pattern)
 * - Autonomous Execution
 * - Comment Formatting
 * - Coverage Analysis
 * - Feedback & Learning
 */

export { analyzePullRequest } from './analyzer.js';
export { callLLM, callLLMWithUsage, type LLMCallOptions, type LLMResponse } from './llm.js';
export { formatComment, formatErrorComment } from './formatter.js';
export { handlePullRequestEvent, handleCommentCommand, handleSilentPRAnalysis } from './orchestrator.js';
export { 
  generateTests, 
  writeTestFiles,
  formatTestSummary,
  type GeneratedTest,
  type TestGenerationResult,
} from './test-generator.js';
export {
  executeAutonomously,
  formatAutonomousExecutionSummary,
  type AutonomousExecutionResult,
} from './autonomous-executor.js';
export {
  analyzeCoverage,
  detectCoverageReport,
  parseCoverageReport,
  formatCoverageSection,
  type CoverageReport,
  type CoverageAnalysisResult,
  type CoverageSuggestion,
  type FileCoverage,
} from './coverage-analyzer.js';
export {
  collectFeedback,
  collectPendingFeedback,
  analyzeFeedback,
  generateLearningInsights,
  getPromptEnhancements,
  generateFeedbackSection,
  formatFeedbackStats,
  type FeedbackEntry,
  type FeedbackStats,
  type LearningInsights,
} from './feedback-collector.js';
export {
  analyzeRequirements,
  validateRequirementsInput,
  formatRequirementsAnalysis,
  type RequirementsInput,
  type RequirementsAnalysisResult,
  type PreImplementationScenario,
  type AcceptanceCriteria,
  type RequirementRisk,
  type RequirementGap,
  type UIAnalysis,
} from './requirements-analyzer.js';
export {
  parsePDFFromBase64,
  parsePDFBuffer,
  extractUserStories,
  extractAcceptanceCriteria,
  type ParsedPDF,
} from './pdf-parser.js';
export {
  validateTestSyntax,
  validateTestBatch,
  generateFixSuggestions,
  type ValidationResult,
  type ValidationError,
  type ValidationWarning,
  type BatchValidationResult,
} from './test-validator.js';
export {
  analyzeDependencies,
  formatDependencySection,
  type DependencyAnalysisResult,
  type DependencyChange,
  type DependencyRisk,
  type DependencySummary,
} from './dependency-analyzer.js';
export {
  attemptAutoFix,
  formatAutoFixSummary,
  type CIFailureInfo,
  type FixAttempt,
  type AutoFixResult,
} from './ci-fixer.js';
export {
  generateProductImpactReport,
  formatProductImpactMarkdown,
  buildProductImpactSlackMessage,
  type ProductImpactReport,
  type UXImpactItem,
  type BusinessRisk,
  type ProductRecommendation,
} from './product-impact.js';
export * from './types.js';
