// =============================================================================
// Pull Request Context
// =============================================================================

export interface PullRequestContext {
  owner: string;
  repo: string;
  pullNumber: number;
  title: string;
  body: string | null;
  diff: string;
  action: string;
  installationId: number;
}

// =============================================================================
// Risk & Priority
// =============================================================================

export type RiskLevel = 'critical' | 'high' | 'medium' | 'low';

export interface RiskMitigation {
  preventive: string;  // O que fazer ANTES para evitar
  detective: string;   // Como DETECTAR se aconteceu
  corrective: string;  // Como CORRIGIR rapidamente
}

export interface RiskAssessment {
  level: RiskLevel;
  area: string;
  title: string;
  description: string;
  probability?: 'alta' | 'média' | 'baixa' | 'high' | 'medium' | 'low';
  impact?: string;
  mitigation: RiskMitigation | string; // Suporta objeto estruturado ou string legada
  testsRequired?: string[];
  relatedRisks?: string[];
  // Aliases for database compatibility
  severity?: RiskLevel;
}

// =============================================================================
// Test Scenario Taxonomy
// =============================================================================

export type ScenarioCategory = 
  | 'happy_path'      // Fluxo principal de sucesso
  | 'sad_path'        // Fluxos de erro esperados
  | 'edge_case'       // Casos de borda e limites
  | 'boundary'        // Valores limite (min, max, zero)
  | 'security'        // Vulnerabilidades e autenticação
  | 'performance'     // Carga, stress, tempo de resposta
  | 'accessibility'   // Acessibilidade (a11y)
  | 'integration'     // Integração entre sistemas
  | 'data_integrity'; // Consistência de dados

export type TestType = 'unit' | 'integration' | 'e2e' | 'api' | 'visual' | 'performance';

export interface AutomatedTest {
  framework: 'playwright' | 'vitest' | 'jest';
  filename: string;
  code: string;
}

export interface TestScenario {
  id: string;
  title: string;
  category: ScenarioCategory;
  priority: RiskLevel;
  preconditions: string[];
  steps: string[];
  expectedResult: string;
  testType: TestType;
  heuristic?: TestHeuristic;
  relatedRisks?: string[];
  automatedTest?: AutomatedTest;
}

// =============================================================================
// QA Heuristics
// =============================================================================

export type TestHeuristic =
  | 'equivalence_partitioning'  // Partição de equivalência
  | 'boundary_value_analysis'   // Análise de valor limite
  | 'state_transition'          // Transição de estados
  | 'decision_table'            // Tabela de decisão
  | 'error_guessing'            // Adivinhação de erros
  | 'exploratory'               // Teste exploratório
  | 'pairwise'                  // Teste pairwise
  | 'mutation';                 // Teste de mutação

// =============================================================================
// Test Suggestions
// =============================================================================

export interface PlaywrightTestSuggestion {
  id?: string;
  scenarioId?: string;
  name: string;
  description: string;
  filename?: string;
  code: string;
}

export interface UnitTestSuggestion {
  id: string;
  scenarioId?: string;
  name: string;
  description: string;
  filename: string;
  framework: 'vitest' | 'jest';
  code: string;
}

// =============================================================================
// Merge Recommendation (Pilar 1 - Governança de Risco)
// =============================================================================

export type MergeRecommendation = 'merge_ok' | 'attention' | 'block';

export const MERGE_RECOMMENDATION_LABELS: Record<MergeRecommendation, { emoji: string; label: string; labelPtBr: string; color: string; description: string; descriptionPtBr: string }> = {
  merge_ok: {
    emoji: '✅',
    label: 'Merge OK',
    labelPtBr: 'Merge OK',
    color: '#16a34a',
    description: 'No significant risks found. Safe to merge.',
    descriptionPtBr: 'Nenhum risco significativo encontrado. Seguro para merge.',
  },
  attention: {
    emoji: '⚠️',
    label: 'Attention Required',
    labelPtBr: 'Atenção Necessária',
    color: '#ca8a04',
    description: 'Medium risks detected. Review recommendations before merging.',
    descriptionPtBr: 'Riscos médios detectados. Revise as recomendações antes do merge.',
  },
  block: {
    emoji: '🚫',
    label: 'Block - Fix Required',
    labelPtBr: 'Bloquear - Correção Necessária',
    color: '#dc2626',
    description: 'Critical or high risks detected. Fix issues before merging.',
    descriptionPtBr: 'Riscos críticos ou altos detectados. Corrija antes do merge.',
  },
};

// =============================================================================
// Analysis Result (Professional Output)
// =============================================================================

export interface AnalysisResult {
  // Metadata
  version: string;
  analyzedAt: string;
  
  // Summary
  summary: {
    title: string;
    description: string;
    impactAreas: string[];
    changeType: 'feature' | 'bugfix' | 'refactor' | 'config' | 'docs' | 'mixed';
  };

  // Risk Analysis
  overallRisk: RiskLevel;
  risks: RiskAssessment[];

  // === PILAR 1: Governança de Risco ===
  
  /** Numeric risk score 0-100 (0 = no risk, 100 = maximum risk) */
  riskScore: number;

  /** Merge recommendation based on risk analysis */
  mergeRecommendation: MergeRecommendation;

  /** Product impact summary - translates technical risks into business impact */
  productImpact?: string;

  // Test Scenarios (Taxonomized)
  scenarios: TestScenario[];

  // Gaps & Issues
  gaps: {
    title: string;
    severity: RiskLevel;
    recommendation: string;
    riskIfIgnored?: string;
  }[];

  // Acceptance Criteria Suggestions
  acceptanceCriteria: string[];

  // Test Coverage Recommendations
  testCoverage: {
    unit: string[];
    integration: string[];
    e2e: string[];
    manual: string[];
  };

  // Playwright Test Suggestions (E2E)
  playwrightTests?: PlaywrightTestSuggestion[];

  // Unit Test Suggestions
  unitTests?: UnitTestSuggestion[];

  // Raw LLM response (fallback)
  raw: string;
}

// =============================================================================
// Webhook Payload
// =============================================================================

export interface WebhookPayload {
  action: string;
  number: number;
  pull_request: {
    number: number;
    title: string;
    body: string | null;
    diff_url: string;
    head: {
      sha: string;
      ref?: string;  // Branch name
    };
    user?: {
      login: string;
      type?: string;  // 'User' | 'Bot'
    };
  };
  repository: {
    name: string;
    owner: {
      login: string;
    };
  };
  installation?: {
    id: number;
  };
}

// =============================================================================
// Issue Comment Payload (for /keelo commands)
// =============================================================================

export interface IssueCommentPayload {
  action: 'created' | 'edited' | 'deleted';
  issue: {
    number: number;
    title: string;
    pull_request?: {
      url: string;
      html_url: string;
    };
  };
  comment: {
    id: number;
    body: string;
    user: {
      login: string;
      type: 'User' | 'Bot';
    };
    created_at: string;
  };
  repository: {
    name: string;
    full_name: string;
    owner: {
      login: string;
    };
  };
  installation?: {
    id: number;
  };
  sender: {
    login: string;
    type: 'User' | 'Bot';
  };
}

// =============================================================================
// Labels & Constants
// =============================================================================

export const RISK_LABELS: Record<RiskLevel, { emoji: string; label: string; color: string }> = {
  critical: { emoji: '🔴', label: 'Critical', color: '#dc2626' },
  high: { emoji: '🟠', label: 'High', color: '#ea580c' },
  medium: { emoji: '🟡', label: 'Medium', color: '#ca8a04' },
  low: { emoji: '🟢', label: 'Low', color: '#16a34a' },
};

export const CATEGORY_LABELS: Record<ScenarioCategory, { emoji: string; label: string }> = {
  happy_path: { emoji: '✅', label: 'Happy Path' },
  sad_path: { emoji: '❌', label: 'Sad Path' },
  edge_case: { emoji: '⚠️', label: 'Edge Case' },
  boundary: { emoji: '📏', label: 'Boundary' },
  security: { emoji: '🔒', label: 'Security' },
  performance: { emoji: '⚡', label: 'Performance' },
  accessibility: { emoji: '♿', label: 'Accessibility' },
  integration: { emoji: '🔗', label: 'Integration' },
  data_integrity: { emoji: '💾', label: 'Data Integrity' },
};

export const HEURISTIC_LABELS: Record<TestHeuristic, string> = {
  equivalence_partitioning: 'Equivalence Partitioning',
  boundary_value_analysis: 'Boundary Value Analysis',
  state_transition: 'State Transition Testing',
  decision_table: 'Decision Table Testing',
  error_guessing: 'Error Guessing',
  exploratory: 'Exploratory Testing',
  pairwise: 'Pairwise Testing',
  mutation: 'Mutation Testing',
};
