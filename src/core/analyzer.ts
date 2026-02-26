import { SYSTEM_PROMPT, buildUserPrompt, getLLMConfig, logger } from '../config/index.js';
import { callLLM } from './llm.js';
import type { PullRequestContext, AnalysisResult, RiskLevel, MergeRecommendation, RiskAssessment } from './types.js';

const MAX_DIFF_LENGTH = 15000;

// =============================================================================
// Main Analysis Function
// =============================================================================

export async function analyzePullRequest(
  context: PullRequestContext,
  promptEnhancements: string[] = []
): Promise<AnalysisResult> {
  const llmConfig = getLLMConfig();
  const description = context.body || 'No description provided';
  
  // Limit diff size to avoid token limits
  const diff = context.diff.length > MAX_DIFF_LENGTH 
    ? context.diff.substring(0, MAX_DIFF_LENGTH) + '\n\n... [diff truncated due to size]'
    : context.diff;

  const userPrompt = buildUserPrompt(context.title, description, diff);

  // Enhance system prompt with learning insights
  let enhancedSystemPrompt = SYSTEM_PROMPT;
  if (promptEnhancements.length > 0) {
    enhancedSystemPrompt += '\n\n## Ajustes Baseados em Feedback Anterior\n\n';
    enhancedSystemPrompt += promptEnhancements.map(e => `- ${e}`).join('\n');
    enhancedSystemPrompt += '\n\nConsidere esses ajustes na sua análise.';
    
    logger.info({ 
      enhancementsCount: promptEnhancements.length 
    }, 'Applied learning enhancements to prompt');
  }

  logger.info({ 
    provider: llmConfig.provider,
    diffLength: context.diff.length, 
    truncated: context.diff.length > MAX_DIFF_LENGTH,
    hasEnhancements: promptEnhancements.length > 0,
  }, 'Sending to LLM');

  const content = await callLLM({
    systemPrompt: enhancedSystemPrompt,
    userPrompt,
    jsonMode: true,
  });

  // Parse the JSON response
  const result = parseAnalysisResponse(content);

  // === PILAR 1: Calculate Risk Score & Merge Recommendation ===
  result.riskScore = calculateRiskScore(result);
  result.mergeRecommendation = determineMergeRecommendation(result.riskScore, result.overallRisk);

  // Extract product impact from LLM or generate fallback
  if (!result.productImpact) {
    result.productImpact = generateProductImpact(result);
  }

  logger.info({
    riskScore: result.riskScore,
    mergeRecommendation: result.mergeRecommendation,
    overallRisk: result.overallRisk,
  }, 'Risk governance decision calculated');
  
  return result;
}

// =============================================================================
// Response Parsing
// =============================================================================

function parseAnalysisResponse(content: string): AnalysisResult {
  const now = new Date().toISOString();
  
  try {
    const parsed = JSON.parse(content);
    
    // Validate and normalize the response
    const result: AnalysisResult = {
      version: '1.0.0',
      analyzedAt: now,
      summary: {
        title: parsed.summary?.title || 'Analysis completed',
        description: parsed.summary?.description || '',
        impactAreas: Array.isArray(parsed.summary?.impactAreas) ? parsed.summary.impactAreas : [],
        changeType: validateChangeType(parsed.summary?.changeType),
      },
      overallRisk: validateRiskLevel(parsed.overallRisk),
      risks: Array.isArray(parsed.risks) ? parsed.risks.map(normalizeRisk) : [],
      // Pilar 1: Will be calculated after parsing
      riskScore: 0,
      mergeRecommendation: 'merge_ok',
      productImpact: typeof parsed.productImpact === 'string' ? parsed.productImpact : undefined,
      scenarios: Array.isArray(parsed.scenarios) ? parsed.scenarios.map(normalizeScenario) : [],
      gaps: Array.isArray(parsed.gaps) ? parsed.gaps.map(normalizeGap) : [],
      acceptanceCriteria: Array.isArray(parsed.acceptanceCriteria) ? parsed.acceptanceCriteria : [],
      testCoverage: {
        unit: Array.isArray(parsed.testCoverage?.unit) ? parsed.testCoverage.unit : [],
        integration: Array.isArray(parsed.testCoverage?.integration) ? parsed.testCoverage.integration : [],
        e2e: Array.isArray(parsed.testCoverage?.e2e) ? parsed.testCoverage.e2e : [],
        manual: Array.isArray(parsed.testCoverage?.manual) ? parsed.testCoverage.manual : [],
      },
      // Parse Playwright test suggestions (E2E)
      playwrightTests: Array.isArray(parsed.playwrightTests) 
        ? parsed.playwrightTests.map(normalizePlaywrightTest) 
        : [],
      // Parse Unit test suggestions
      unitTests: Array.isArray(parsed.unitTests)
        ? parsed.unitTests.map(normalizeUnitTest)
        : [],
      raw: content,
    };

    logger.info({
      risksCount: result.risks.length,
      scenariosCount: result.scenarios.length,
      playwrightTestsCount: result.playwrightTests?.length || 0,
      unitTestsCount: result.unitTests?.length || 0,
    }, 'Analysis parsed successfully');

    return result;
  } catch (error) {
    logger.error({ error, content: content.substring(0, 500) }, 'Failed to parse LLM response');
    
    // Return a fallback result with raw content
    return {
      version: '1.0.0',
      analyzedAt: now,
      summary: {
        title: 'Analysis completed (parsing failed)',
        description: 'The analysis was completed but could not be parsed into structured format.',
        impactAreas: [],
        changeType: 'mixed',
      },
      overallRisk: 'medium',
      risks: [],
      riskScore: 50,
      mergeRecommendation: 'attention' as MergeRecommendation,
      productImpact: 'Análise não pôde ser completamente processada. Recomendamos revisão manual.',
      scenarios: [],
      gaps: [],
      acceptanceCriteria: [],
      testCoverage: { unit: [], integration: [], e2e: [], manual: [] },
      playwrightTests: [],
      unitTests: [],
      raw: content,
    };
  }
}

function validateRiskLevel(level: unknown): RiskLevel {
  const validLevels: RiskLevel[] = ['critical', 'high', 'medium', 'low'];
  return validLevels.includes(level as RiskLevel) ? (level as RiskLevel) : 'medium';
}

function validateChangeType(type: unknown): AnalysisResult['summary']['changeType'] {
  const validTypes = ['feature', 'bugfix', 'refactor', 'config', 'docs', 'mixed'] as const;
  return validTypes.includes(type as typeof validTypes[number]) 
    ? (type as typeof validTypes[number]) 
    : 'mixed';
}

function normalizeMitigation(mitigation: unknown): { preventive: string; detective: string; corrective: string } | string {
  // Se for um objeto com a estrutura esperada
  if (mitigation && typeof mitigation === 'object' && !Array.isArray(mitigation)) {
    const obj = mitigation as Record<string, unknown>;
    if (obj.preventive || obj.detective || obj.corrective) {
      return {
        preventive: String(obj.preventive || obj.preventivo || ''),
        detective: String(obj.detective || obj.detectivo || ''),
        corrective: String(obj.corrective || obj.corretivo || ''),
      };
    }
  }
  // Fallback para string
  return String(mitigation || '');
}

function normalizeRisk(risk: Record<string, unknown>) {
  return {
    level: validateRiskLevel(risk.level),
    area: String(risk.area || ''),
    title: String(risk.title || risk.area || ''),
    description: String(risk.description || ''),
    probability: risk.probability ? String(risk.probability) : undefined,
    impact: risk.impact ? String(risk.impact) : undefined,
    mitigation: normalizeMitigation(risk.mitigation),
    testsRequired: Array.isArray(risk.testsRequired) ? risk.testsRequired.map(String) : undefined,
    relatedRisks: Array.isArray(risk.relatedRisks) ? risk.relatedRisks.map(String) : undefined,
    // For database compatibility
    severity: validateRiskLevel(risk.level),
  };
}

function normalizeAutomatedTest(automatedTest: unknown) {
  if (!automatedTest || typeof automatedTest !== 'object') {
    return undefined;
  }
  const test = automatedTest as Record<string, unknown>;
  if (!test.code) {
    return undefined;
  }
  return {
    framework: (test.framework as 'playwright' | 'vitest' | 'jest') || 'playwright',
    filename: String(test.filename || 'test.spec.ts'),
    code: String(test.code),
  };
}

function normalizeScenario(scenario: Record<string, unknown>, index: number) {
  return {
    id: String(scenario.id || `TC${String(index + 1).padStart(3, '0')}`),
    title: String(scenario.title || ''),
    category: scenario.category || 'happy_path',
    priority: validateRiskLevel(scenario.priority),
    preconditions: Array.isArray(scenario.preconditions) ? scenario.preconditions : [],
    steps: Array.isArray(scenario.steps) ? scenario.steps : [],
    expectedResult: String(scenario.expectedResult || ''),
    testType: scenario.testType || 'e2e',
    heuristic: scenario.heuristic,
    relatedRisks: Array.isArray(scenario.relatedRisks) ? scenario.relatedRisks.map(String) : undefined,
    automatedTest: normalizeAutomatedTest(scenario.automatedTest),
  };
}

function normalizeGap(gap: Record<string, unknown>) {
  return {
    title: String(gap.title || ''),
    severity: validateRiskLevel(gap.severity),
    recommendation: String(gap.recommendation || ''),
    riskIfIgnored: gap.riskIfIgnored ? String(gap.riskIfIgnored) : undefined,
  };
}

function normalizePlaywrightTest(test: Record<string, unknown>) {
  return {
    id: test.id ? String(test.id) : undefined,
    scenarioId: test.scenarioId ? String(test.scenarioId) : undefined,
    name: String(test.name || 'Test'),
    description: String(test.description || ''),
    filename: test.filename ? String(test.filename) : undefined,
    code: String(test.code || '// No code generated'),
  };
}

function normalizeUnitTest(test: Record<string, unknown>) {
  return {
    id: String(test.id || `UT${Date.now()}`),
    scenarioId: test.scenarioId ? String(test.scenarioId) : undefined,
    name: String(test.name || 'Unit Test'),
    description: String(test.description || ''),
    filename: String(test.filename || 'test.spec.ts'),
    framework: (test.framework as 'vitest' | 'jest') || 'vitest',
    code: String(test.code || '// No code generated'),
  };
}

// =============================================================================
// PILAR 1: Risk Score Calculation
// =============================================================================

const RISK_WEIGHTS: Record<RiskLevel, number> = {
  critical: 40,
  high: 25,
  medium: 10,
  low: 3,
};

const GAP_WEIGHTS: Record<RiskLevel, number> = {
  critical: 15,
  high: 10,
  medium: 5,
  low: 2,
};

/**
 * Calculates a numeric risk score (0-100) based on:
 * - Number and severity of identified risks
 * - Number and severity of gaps
 * - Overall risk level
 * - Presence of critical scenarios without test coverage
 * 
 * Score ranges:
 * 0-20: Very safe, minimal risks
 * 21-40: Low risk, minor issues
 * 41-60: Medium risk, needs attention
 * 61-80: High risk, significant issues
 * 81-100: Critical risk, serious problems
 */
export function calculateRiskScore(analysis: AnalysisResult): number {
  let score = 0;

  // 1. Base score from overall risk level (0-30)
  const baseScores: Record<RiskLevel, number> = {
    critical: 30,
    high: 20,
    medium: 10,
    low: 0,
  };
  score += baseScores[analysis.overallRisk] || 0;

  // 2. Individual risks contribution (0-50)
  let riskContribution = 0;
  for (const risk of analysis.risks) {
    riskContribution += RISK_WEIGHTS[risk.level] || 0;
  }
  // Cap individual risk contribution at 50
  score += Math.min(riskContribution, 50);

  // 3. Gaps contribution (0-15)
  let gapContribution = 0;
  for (const gap of analysis.gaps) {
    gapContribution += GAP_WEIGHTS[gap.severity] || 0;
  }
  // Cap gap contribution at 15
  score += Math.min(gapContribution, 15);

  // 4. Unmitigated critical scenarios bonus (0-5)
  const criticalScenarios = analysis.scenarios.filter(s => s.priority === 'critical');
  const scenariosWithTests = criticalScenarios.filter(s => s.automatedTest?.code);
  if (criticalScenarios.length > 0 && scenariosWithTests.length < criticalScenarios.length) {
    score += 5;
  }

  // Ensure score is between 0-100
  return Math.max(0, Math.min(100, Math.round(score)));
}

/**
 * Determines merge recommendation based on risk score and overall risk level.
 * 
 * Rules:
 * - block: score >= 70 OR any critical risk
 * - attention: score >= 30 OR any high risk
 * - merge_ok: everything else
 */
export function determineMergeRecommendation(
  riskScore: number,
  overallRisk: RiskLevel
): MergeRecommendation {
  // Critical risk = always block
  if (overallRisk === 'critical' || riskScore >= 70) {
    return 'block';
  }

  // High risk or moderate score = attention
  if (overallRisk === 'high' || riskScore >= 30) {
    return 'attention';
  }

  // Everything else = merge ok
  return 'merge_ok';
}

/**
 * Generates a product impact summary from the analysis.
 * Translates technical risks into business/user impact language.
 */
function generateProductImpact(analysis: AnalysisResult): string {
  const impacts: string[] = [];

  // Critical risks = direct product impact
  const criticalRisks = analysis.risks.filter(r => r.level === 'critical');
  const highRisks = analysis.risks.filter(r => r.level === 'high');

  if (criticalRisks.length > 0) {
    impacts.push(`🔴 ${criticalRisks.length} risco(s) crítico(s) que podem causar indisponibilidade ou perda de dados para o usuário.`);
    for (const risk of criticalRisks) {
      if (risk.impact) {
        impacts.push(`  → ${risk.impact}`);
      }
    }
  }

  if (highRisks.length > 0) {
    impacts.push(`🟠 ${highRisks.length} risco(s) alto(s) que podem impactar funcionalidades essenciais.`);
    for (const risk of highRisks) {
      if (risk.impact) {
        impacts.push(`  → ${risk.impact}`);
      }
    }
  }

  // UX-related gaps
  const uxGaps = analysis.gaps.filter(g => 
    g.title.toLowerCase().includes('ux') || 
    g.title.toLowerCase().includes('usab') ||
    g.title.toLowerCase().includes('experiência') ||
    g.title.toLowerCase().includes('experience') ||
    g.title.toLowerCase().includes('acessib') ||
    g.title.toLowerCase().includes('accessib')
  );
  if (uxGaps.length > 0) {
    impacts.push(`⚠️ ${uxGaps.length} gap(s) de experiência do usuário detectado(s).`);
  }

  // Summary based on overall assessment
  const { scenarios } = analysis;
  const totalScenarios = scenarios.length;
  const coveredScenarios = scenarios.filter(s => s.automatedTest?.code).length;

  if (totalScenarios > 0) {
    const coveragePercent = Math.round((coveredScenarios / totalScenarios) * 100);
    impacts.push(`📊 Cobertura de cenários: ${coveredScenarios}/${totalScenarios} (${coveragePercent}%) com testes automatizados.`);
  }

  if (impacts.length === 0) {
    return 'Mudança de baixo impacto. Nenhum risco significativo para o produto ou experiência do usuário.';
  }

  return impacts.join('\n');
}
