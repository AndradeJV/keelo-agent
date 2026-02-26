import { getLanguage } from '../config/index.js';
import { 
  RISK_LABELS, 
  CATEGORY_LABELS,
  HEURISTIC_LABELS,
  MERGE_RECOMMENDATION_LABELS,
  type AnalysisResult, 
  type PullRequestContext,
  type RiskLevel,
  type MergeRecommendation,
  type TestScenario,
  type ScenarioCategory,
  type TestHeuristic,
  type RiskAssessment,
  type PlaywrightTestSuggestion,
  type UnitTestSuggestion,
} from './types.js';
import { generateProductImpactReport, type ProductImpactReport } from './product-impact.js';

// =============================================================================
// Internationalization
// =============================================================================

const i18n = {
  en: {
    header: '## 🤖 Keelo - QA Analysis Report',
    summary: 'Summary',
    riskAssessment: 'Risk Assessment',
    overallRisk: 'Overall Risk',
    riskScore: 'Risk Score',
    mergeDecision: 'Merge Decision',
    productImpact: 'Product Impact',
    riskAreas: 'Risk Areas',
    riskDetails: 'Risk Details',
    testScenarios: 'Test Scenarios',
    functionalGaps: 'Functional Gaps',
    acceptanceCriteria: 'Acceptance Criteria',
    testCoverage: 'Test Coverage Recommendations',
    playwrightTests: 'Playwright Tests (E2E)',
    unitTestSuggestions: 'Unit Test Suggestions',
    automatedTestCode: 'Automated Test Code',
    unit: 'Unit Tests',
    integration: 'Integration Tests',
    e2e: 'E2E Tests',
    manual: 'Manual Tests',
    preconditions: 'Preconditions',
    steps: 'Steps',
    expected: 'Expected',
    heuristic: 'Technique',
    mitigation: 'Mitigation',
    recommendation: 'Recommendation',
    impactAreas: 'Impact Areas',
    changeType: 'Change Type',
    probability: 'Probability',
    impact: 'Impact',
    testsRequired: 'Required Tests',
    riskIfIgnored: 'Risk if Ignored',
    relatedRisks: 'Related Risks',
    footer: 'Powered by Keelo - Autonomous QA Agent',
    analysisError: 'Analysis Failed',
    errorMessage: 'Keelo encountered an error while analyzing this PR',
    rawOutput: 'Raw Analysis Output',
    changeTypes: {
      feature: 'Feature',
      bugfix: 'Bug Fix',
      refactor: 'Refactor',
      config: 'Configuration',
      docs: 'Documentation',
      mixed: 'Mixed',
    },
  },
  'pt-br': {
    header: '## 🤖 Keelo - Relatório de Análise de QA',
    summary: 'Resumo',
    riskAssessment: 'Avaliação de Risco',
    overallRisk: 'Risco Geral',
    riskScore: 'Risk Score',
    mergeDecision: 'Decisão de Merge',
    productImpact: 'Impacto no Produto',
    riskAreas: 'Áreas de Risco',
    riskDetails: 'Detalhes do Risco',
    testScenarios: 'Cenários de Teste',
    functionalGaps: 'Gaps Funcionais',
    acceptanceCriteria: 'Critérios de Aceite',
    testCoverage: 'Recomendações de Cobertura de Testes',
    playwrightTests: 'Testes Playwright (E2E)',
    unitTestSuggestions: 'Sugestões de Testes Unitários',
    automatedTestCode: 'Código de Teste Automatizado',
    unit: 'Testes Unitários',
    integration: 'Testes de Integração',
    e2e: 'Testes E2E',
    manual: 'Testes Manuais',
    preconditions: 'Pré-condições',
    steps: 'Passos',
    expected: 'Esperado',
    heuristic: 'Técnica',
    mitigation: 'Mitigação',
    recommendation: 'Recomendação',
    impactAreas: 'Áreas Impactadas',
    changeType: 'Tipo de Mudança',
    probability: 'Probabilidade',
    impact: 'Impacto',
    testsRequired: 'Testes Necessários',
    riskIfIgnored: 'Risco se Ignorado',
    relatedRisks: 'Riscos Relacionados',
    footer: 'Powered by Keelo - Agente Autônomo de QA',
    analysisError: 'Análise Falhou',
    errorMessage: 'Keelo encontrou um erro ao analisar este PR',
    rawOutput: 'Saída Bruta da Análise',
    changeTypes: {
      feature: 'Feature',
      bugfix: 'Correção de Bug',
      refactor: 'Refatoração',
      config: 'Configuração',
      docs: 'Documentação',
      mixed: 'Misto',
    },
  },
} as const;

type Language = keyof typeof i18n;

function t(key: keyof typeof i18n['en']): string {
  const lang = getLanguage() as Language;
  const translations = i18n[lang] || i18n.en;
  const value = translations[key];
  return typeof value === 'string' ? value : '';
}

function tChangeType(type: keyof typeof i18n['en']['changeTypes']): string {
  const lang = getLanguage() as Language;
  return i18n[lang]?.changeTypes[type] || i18n.en.changeTypes[type];
}

// =============================================================================
// Formatters
// =============================================================================

function formatRiskBadge(level: RiskLevel): string {
  const { emoji, label } = RISK_LABELS[level];
  return `${emoji} **${label}**`;
}

// =============================================================================
// Decision Banner (Pilar 1)
// =============================================================================

function formatRiskScoreBar(score: number): string {
  const filled = Math.round(score / 5); // 20 blocks total
  const empty = 20 - filled;
  
  let color: string;
  if (score < 30) color = '🟢';
  else if (score < 70) color = '🟡';
  else color = '🔴';
  
  return `${color} ${'█'.repeat(filled)}${'░'.repeat(empty)} ${score}/100`;
}

function formatDecisionBanner(analysis: AnalysisResult, lang: string): string {
  const mergeRec = analysis.mergeRecommendation || 'attention';
  const mergeInfo = MERGE_RECOMMENDATION_LABELS[mergeRec];
  const description = lang === 'pt-br' ? mergeInfo.descriptionPtBr : mergeInfo.description;
  const label = lang === 'pt-br' ? mergeInfo.labelPtBr : mergeInfo.label;
  
  const lines: string[] = [];
  
  // Big decision box
  lines.push('> ### ' + mergeInfo.emoji + ' ' + label);
  lines.push('>');
  lines.push(`> **Risk Score:** ${formatRiskScoreBar(analysis.riskScore)}`);
  lines.push('>');
  lines.push(`> ${description}`);
  
  // Quick stats
  const risksCount = analysis.risks.length;
  const criticalCount = analysis.risks.filter(r => r.level === 'critical').length;
  const highCount = analysis.risks.filter(r => r.level === 'high').length;
  const scenariosCount = analysis.scenarios.length;
  const gapsCount = analysis.gaps.length;
  
  lines.push('>');
  lines.push(`> | Riscos | Críticos | Altos | Cenários | Gaps |`);
  lines.push(`> |--------|----------|-------|----------|------|`);
  lines.push(`> | ${risksCount} | ${criticalCount > 0 ? '🔴 ' + criticalCount : '0'} | ${highCount > 0 ? '🟠 ' + highCount : '0'} | ${scenariosCount} | ${gapsCount} |`);
  
  return lines.join('\n');
}

function formatCategoryBadge(category: ScenarioCategory): string {
  const { emoji, label } = CATEGORY_LABELS[category] || { emoji: '📋', label: category };
  return `${emoji} ${label}`;
}

function formatHeuristic(heuristic?: TestHeuristic): string {
  if (!heuristic) return '';
  return HEURISTIC_LABELS[heuristic] || heuristic;
}

// =============================================================================
// Main Formatter
// =============================================================================

export function formatComment(
  analysis: AnalysisResult,
  _context: PullRequestContext
): string {
  const sections: string[] = [];
  const lang = getLanguage();

  // Header
  sections.push(t('header'));
  sections.push('');

  // =========================================================================
  // DECISION BANNER (Pilar 1 - Governança de Risco)
  // =========================================================================
  sections.push(formatDecisionBanner(analysis, lang));
  sections.push('');

  // Summary Section
  sections.push(`### 📋 ${t('summary')}`);
  sections.push('');
  sections.push(`**${analysis.summary.title}**`);
  sections.push('');
  sections.push(analysis.summary.description);
  sections.push('');
  
  if (analysis.summary.impactAreas.length > 0) {
    sections.push(`> **${t('impactAreas')}:** ${analysis.summary.impactAreas.join(', ')}`);
  }
  sections.push(`> **${t('changeType')}:** ${tChangeType(analysis.summary.changeType)}`);
  sections.push('');

  // Product Impact Section (Pilar 3 - Qualidade como Feedback de Produto)
  sections.push(formatProductImpactSection(analysis));
  sections.push('');

  // Risk Assessment Section (PRIORITY - More Detailed)
  sections.push(`### 🚨 ${t('riskAssessment')}`);
  sections.push('');
  sections.push(`**${t('overallRisk')}:** ${formatRiskBadge(analysis.overallRisk)} | **${t('riskScore')}:** ${analysis.riskScore}/100`);
  sections.push('');

  if (analysis.risks.length > 0) {
    // Summary table
    sections.push(`#### ${t('riskAreas')}`);
    sections.push('');
    sections.push('| Risco | Área | Título | Probabilidade |');
    sections.push('|-------|------|--------|---------------|');
    for (const risk of analysis.risks) {
      const prob = risk.probability || '-';
      const title = risk.title || risk.description.substring(0, 50);
      sections.push(`| ${formatRiskBadge(risk.level)} | ${risk.area} | ${title} | ${prob} |`);
    }
    sections.push('');

    // Detailed risk cards
    sections.push(`#### ${t('riskDetails')}`);
    sections.push('');
    for (const risk of analysis.risks) {
      sections.push(formatRiskCard(risk));
    }
  }

  // Test Scenarios Section
  if (analysis.scenarios.length > 0) {
    sections.push(`### 🧪 ${t('testScenarios')}`);
    sections.push('');

    // Group scenarios by category
    const grouped = groupScenariosByCategory(analysis.scenarios);
    
    for (const [category, scenarios] of Object.entries(grouped)) {
      const categoryLabel = formatCategoryBadge(category as ScenarioCategory);
      sections.push(`#### ${categoryLabel}`);
      sections.push('');

      for (const scenario of scenarios) {
        sections.push(formatScenario(scenario));
      }
    }
  }

  // Playwright Tests Section (E2E)
  if (analysis.playwrightTests && analysis.playwrightTests.length > 0) {
    sections.push(`### 🎭 ${t('playwrightTests')}`);
    sections.push('');
    sections.push(`> ${analysis.playwrightTests.length} teste(s) E2E gerado(s) automaticamente`);
    sections.push('');
    
    for (const test of analysis.playwrightTests) {
      sections.push(formatPlaywrightTest(test));
    }
  }

  // Unit Tests Section
  if (analysis.unitTests && analysis.unitTests.length > 0) {
    sections.push(`### 🧪 ${t('unitTestSuggestions')}`);
    sections.push('');
    sections.push(`> ${analysis.unitTests.length} teste(s) unitário(s) gerado(s) automaticamente`);
    sections.push('');
    
    for (const test of analysis.unitTests) {
      sections.push(formatUnitTest(test));
    }
  }

  // Gaps Section
  if (analysis.gaps.length > 0) {
    sections.push(`### 🔍 ${t('functionalGaps')}`);
    sections.push('');
    
    for (const gap of analysis.gaps) {
      sections.push(`<details>`);
      sections.push(`<summary>${formatRiskBadge(gap.severity)} <b>${gap.title}</b></summary>`);
      sections.push('');
      sections.push(`**${t('recommendation')}:** ${gap.recommendation}`);
      if (gap.riskIfIgnored) {
        sections.push('');
        sections.push(`**${t('riskIfIgnored')}:** ${gap.riskIfIgnored}`);
      }
      sections.push('');
      sections.push('</details>');
      sections.push('');
    }
  }

  // Acceptance Criteria Section
  if (analysis.acceptanceCriteria.length > 0) {
    sections.push(`### ✅ ${t('acceptanceCriteria')}`);
    sections.push('');
    for (const criteria of analysis.acceptanceCriteria) {
      sections.push(`- ${criteria}`);
    }
    sections.push('');
  }

  // Test Coverage Section
  const hasCoverage = 
    analysis.testCoverage.unit.length > 0 ||
    analysis.testCoverage.integration.length > 0 ||
    analysis.testCoverage.e2e.length > 0 ||
    analysis.testCoverage.manual.length > 0;

  if (hasCoverage) {
    sections.push(`### 📊 ${t('testCoverage')}`);
    sections.push('');

    if (analysis.testCoverage.unit.length > 0) {
      sections.push(`**${t('unit')}:**`);
      for (const item of analysis.testCoverage.unit) {
        sections.push(`- ${item}`);
      }
      sections.push('');
    }

    if (analysis.testCoverage.integration.length > 0) {
      sections.push(`**${t('integration')}:**`);
      for (const item of analysis.testCoverage.integration) {
        sections.push(`- ${item}`);
      }
      sections.push('');
    }

    if (analysis.testCoverage.e2e.length > 0) {
      sections.push(`**${t('e2e')}:**`);
      for (const item of analysis.testCoverage.e2e) {
        sections.push(`- ${item}`);
      }
      sections.push('');
    }

    if (analysis.testCoverage.manual.length > 0) {
      sections.push(`**${t('manual')}:**`);
      for (const item of analysis.testCoverage.manual) {
        sections.push(`- ${item}`);
      }
      sections.push('');
    }
  }

  // Fallback to raw output if parsing failed
  if (!analysis.summary.description && analysis.raw) {
    sections.push(`### 📄 ${t('rawOutput')}`);
    sections.push('');
    sections.push('```');
    sections.push(analysis.raw.substring(0, 3000));
    sections.push('```');
    sections.push('');
  }

  // Footer
  sections.push('---');
  sections.push(`*${t('footer')} | v${analysis.version}*`);

  return sections.join('\n');
}

function formatMitigation(mitigation: RiskAssessment['mitigation'], lang: string): string {
  // Se for string simples (legado)
  if (typeof mitigation === 'string') {
    return `**🛡️ ${t('mitigation')}:** ${mitigation}\n`;
  }
  
  // Se for objeto estruturado
  const preventiveLabel = lang === 'pt-br' ? 'Preventivo' : 'Preventive';
  const detectiveLabel = lang === 'pt-br' ? 'Detectivo' : 'Detective';
  const correctiveLabel = lang === 'pt-br' ? 'Corretivo' : 'Corrective';
  
  const lines: string[] = [];
  lines.push(`**🛡️ ${t('mitigation')}:**`);
  lines.push('');
  
  if (mitigation.preventive) {
    lines.push(`| 🔒 **${preventiveLabel}** | ${mitigation.preventive} |`);
  }
  if (mitigation.detective) {
    lines.push(`| 🔍 **${detectiveLabel}** | ${mitigation.detective} |`);
  }
  if (mitigation.corrective) {
    lines.push(`| 🔧 **${correctiveLabel}** | ${mitigation.corrective} |`);
  }
  
  if (lines.length > 2) {
    // Insert table header
    lines.splice(2, 0, '| Tipo | Ação |', '|------|------|');
  }
  
  lines.push('');
  return lines.join('\n');
}

function formatRiskCard(risk: RiskAssessment): string {
  const lines: string[] = [];
  const lang = getLanguage();
  
  lines.push('<details>');
  lines.push(`<summary>${formatRiskBadge(risk.level)} <b>${risk.title || risk.area}</b></summary>`);
  lines.push('');
  lines.push(`**📍 Área:** ${risk.area}`);
  lines.push('');
  lines.push(`**📝 Descrição:** ${risk.description}`);
  lines.push('');
  
  if (risk.probability) {
    lines.push(`**📊 ${t('probability')}:** ${risk.probability}`);
    lines.push('');
  }
  
  if (risk.impact) {
    lines.push(`**💥 ${t('impact')}:** ${risk.impact}`);
    lines.push('');
  }
  
  lines.push(formatMitigation(risk.mitigation, lang));
  
  if (risk.testsRequired && risk.testsRequired.length > 0) {
    lines.push(`**🧪 ${t('testsRequired')}:**`);
    for (const test of risk.testsRequired) {
      lines.push(`- ${test}`);
    }
    lines.push('');
  }
  
  if (risk.relatedRisks && risk.relatedRisks.length > 0) {
    lines.push(`**🔗 ${t('relatedRisks')}:** ${risk.relatedRisks.join(', ')}`);
    lines.push('');
  }
  
  lines.push('</details>');
  lines.push('');
  
  return lines.join('\n');
}

function formatPlaywrightTest(test: PlaywrightTestSuggestion): string {
  const lines: string[] = [];
  
  const filename = test.filename ? ` (${test.filename})` : '';
  const linkedScenario = test.scenarioId ? ` → ${test.scenarioId}` : '';
  
  lines.push('<details>');
  lines.push(`<summary>🎭 <b>${test.name}</b>${filename}${linkedScenario}</summary>`);
  lines.push('');
  if (test.description) {
    lines.push(`> ${test.description}`);
    lines.push('');
  }
  lines.push('```typescript');
  lines.push(test.code);
  lines.push('```');
  lines.push('');
  lines.push('</details>');
  lines.push('');
  
  return lines.join('\n');
}

function formatUnitTest(test: UnitTestSuggestion): string {
  const lines: string[] = [];
  
  const linkedScenario = test.scenarioId ? ` → ${test.scenarioId}` : '';
  
  lines.push('<details>');
  lines.push(`<summary>🧪 <b>${test.name}</b> (${test.filename})${linkedScenario}</summary>`);
  lines.push('');
  if (test.description) {
    lines.push(`> ${test.description}`);
    lines.push('');
  }
  lines.push(`**Framework:** ${test.framework}`);
  lines.push('');
  lines.push('```typescript');
  lines.push(test.code);
  lines.push('```');
  lines.push('');
  lines.push('</details>');
  lines.push('');
  
  return lines.join('\n');
}

function formatScenario(scenario: TestScenario): string {
  const lines: string[] = [];
  
  const hasAutomatedTest = scenario.automatedTest?.code;
  const automatedBadge = hasAutomatedTest ? ' ✅' : '';
  
  lines.push(`<details>`);
  lines.push(`<summary><b>${scenario.id}</b> - ${scenario.title} ${formatRiskBadge(scenario.priority)}${automatedBadge}</summary>`);
  lines.push('');
  
  if (scenario.preconditions.length > 0) {
    lines.push(`**${t('preconditions')}:**`);
    for (const pre of scenario.preconditions) {
      lines.push(`- ${pre}`);
    }
    lines.push('');
  }
  
  if (scenario.steps.length > 0) {
    lines.push(`**${t('steps')}:**`);
    scenario.steps.forEach((step, i) => {
      lines.push(`${i + 1}. ${step}`);
    });
    lines.push('');
  }
  
  lines.push(`**${t('expected')}:** ${scenario.expectedResult}`);
  lines.push('');
  
  const heuristic = formatHeuristic(scenario.heuristic as TestHeuristic);
  if (heuristic) {
    lines.push(`> 💡 **${t('heuristic')}:** ${heuristic}`);
    lines.push('');
  }
  
  if (scenario.relatedRisks && scenario.relatedRisks.length > 0) {
    lines.push(`> 🔗 **${t('relatedRisks')}:** ${scenario.relatedRisks.join(', ')}`);
    lines.push('');
  }
  
  // Show automated test code if available
  if (scenario.automatedTest?.code) {
    lines.push(`**📝 ${t('automatedTestCode')}:** (${scenario.automatedTest.framework})`);
    lines.push('');
    lines.push('```typescript');
    lines.push(scenario.automatedTest.code);
    lines.push('```');
    lines.push('');
  }
  
  lines.push('</details>');
  lines.push('');
  
  return lines.join('\n');
}

function groupScenariosByCategory(
  scenarios: TestScenario[]
): Record<string, TestScenario[]> {
  const grouped: Record<string, TestScenario[]> = {};
  
  // Sort by priority first
  const priorityOrder: RiskLevel[] = ['critical', 'high', 'medium', 'low'];
  const sorted = [...scenarios].sort((a, b) => {
    return priorityOrder.indexOf(a.priority) - priorityOrder.indexOf(b.priority);
  });
  
  for (const scenario of sorted) {
    const category = scenario.category as string;
    if (!grouped[category]) {
      grouped[category] = [];
    }
    grouped[category].push(scenario);
  }
  
  return grouped;
}

// =============================================================================
// Product Impact Section (Pilar 3)
// =============================================================================

function formatProductImpactSection(analysis: AnalysisResult): string {
  const report = generateProductImpactReport(analysis);
  const lines: string[] = [];

  const healthEmoji: Record<ProductImpactReport['productHealth']['status'], string> = {
    healthy: '💚',
    attention: '💛',
    degraded: '🧡',
    critical: '❤️',
  };

  lines.push(`### 💼 ${t('productImpact')}`);
  lines.push('');

  // Health indicator
  lines.push(`> ${healthEmoji[report.productHealth.status]} **Saúde do Produto:** ${report.productHealth.score}/100 (${report.productHealth.status}) | Tendência: ${report.productHealth.trend}`);
  lines.push('');

  // Executive summary
  lines.push(report.executiveSummary);
  lines.push('');

  // UX Impact (only show blocking and frustrating)
  const significantUX = report.uxImpact.filter(u => u.severity === 'blocking' || u.severity === 'frustrating');
  if (significantUX.length > 0) {
    const severityEmoji: Record<string, string> = {
      blocking: '🚫',
      frustrating: '😤',
      annoying: '😕',
      minor: '💡',
    };

    lines.push('**Impacto na Experiência do Usuário:**');
    lines.push('');
    lines.push('| Severidade | Área | Impacto | Métrica |');
    lines.push('|------------|------|---------|---------|');
    for (const impact of significantUX.slice(0, 5)) {
      const emoji = severityEmoji[impact.severity];
      lines.push(`| ${emoji} ${impact.severity} | ${impact.area} | ${impact.issue.substring(0, 50)} | ${impact.metric || '-'} |`);
    }
    lines.push('');
  }

  // Top recommendations (must-do only in PR)
  const mustDo = report.recommendations.filter(r => r.priority === 'must-do');
  if (mustDo.length > 0) {
    lines.push('**🔴 Ações Obrigatórias:**');
    lines.push('');
    for (const rec of mustDo) {
      lines.push(`- **${rec.title}**: ${rec.description}`);
    }
    lines.push('');
  }

  // Optional: brief business risk summary
  const immediateRisks = report.businessRisks.filter(r => r.urgency === 'immediate');
  if (immediateRisks.length > 0) {
    lines.push(`> ⚠️ **${immediateRisks.length} risco(s) de negócio** requer(em) ação imediata. Consulte o relatório completo de impacto no produto.`);
    lines.push('');
  }

  return lines.join('\n');
}

// =============================================================================
// Error Formatter
// =============================================================================

export function formatErrorComment(error: Error): string {
  return `${t('header')}

### ❌ ${t('analysisError')}

${t('errorMessage')}:

\`\`\`
${error.message}
\`\`\`

---
*${t('footer')}*`;
}
