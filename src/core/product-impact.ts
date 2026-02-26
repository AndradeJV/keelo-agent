import { logger } from '../config/index.js';
import type { AnalysisResult, RiskLevel, RiskAssessment, MergeRecommendation } from './types.js';
import { MERGE_RECOMMENDATION_LABELS } from './types.js';

// =============================================================================
// Types
// =============================================================================

export interface ProductImpactReport {
  /** Report metadata */
  generatedAt: string;
  analysisId?: string;
  prNumber?: number;
  repository?: string;

  /** Executive summary - 2-3 sentences max */
  executiveSummary: string;

  /** Overall product health indicator */
  productHealth: {
    score: number;        // 0-100 (100 = no impact on product)
    status: 'healthy' | 'attention' | 'degraded' | 'critical';
    trend: string;        // e.g., "stable", "improving", "degrading"
  };

  /** Merge decision in business language */
  mergeDecision: {
    recommendation: MergeRecommendation;
    emoji: string;
    label: string;
    reason: string;       // Business-friendly reason
  };

  /** User experience impact */
  uxImpact: UXImpactItem[];

  /** Business risk items (translated from technical risks) */
  businessRisks: BusinessRisk[];

  /** Actionable recommendations for PM/CTO */
  recommendations: ProductRecommendation[];

  /** Metrics summary for quick reading */
  metricsSummary: {
    totalRisks: number;
    criticalRisks: number;
    uxIssues: number;
    testScenarios: number;
    coverageGaps: number;
    riskScore: number;
  };
}

export interface UXImpactItem {
  area: string;
  issue: string;
  userImpact: string;       // "O que o usuário vai sentir"
  severity: 'blocking' | 'frustrating' | 'annoying' | 'minor';
  metric?: string;           // "Risco de abandono +15%", etc.
  affectedJourneys: string[];
}

export interface BusinessRisk {
  title: string;
  businessImpact: string;   // Impacto em linguagem de negócio
  affectedArea: string;
  urgency: 'immediate' | 'short-term' | 'long-term';
  originalRiskLevel: RiskLevel;
  actionRequired: string;
}

export interface ProductRecommendation {
  priority: 'must-do' | 'should-do' | 'nice-to-have';
  title: string;
  description: string;
  expectedOutcome: string;
  effort: 'low' | 'medium' | 'high';
}

// =============================================================================
// Risk → Business Impact Translation
// =============================================================================

const RISK_AREA_BUSINESS_MAP: Record<string, string> = {
  // Security
  'security': 'Confiança e segurança do usuário',
  'auth': 'Acesso à conta do usuário',
  'authentication': 'Acesso à conta do usuário',
  'authorization': 'Permissões e privacidade',
  'xss': 'Segurança dos dados do usuário',
  'injection': 'Integridade dos dados',
  
  // Performance
  'performance': 'Velocidade e responsividade',
  'loading': 'Tempo de espera do usuário',
  'memory': 'Estabilidade da aplicação',
  'cache': 'Velocidade de carregamento',
  
  // Data
  'database': 'Integridade dos dados do usuário',
  'data': 'Dados do cliente',
  'migration': 'Continuidade do serviço',
  'storage': 'Armazenamento de informações',
  
  // UX
  'ui': 'Experiência visual',
  'ux': 'Experiência do usuário',
  'form': 'Preenchimento de formulários',
  'navigation': 'Navegação e fluxo',
  'accessibility': 'Acessibilidade para todos usuários',
  'responsive': 'Experiência em dispositivos móveis',
  
  // API/Integration
  'api': 'Funcionamento de integrações',
  'integration': 'Conexão com serviços externos',
  'payment': 'Processamento de pagamentos',
  'email': 'Comunicação com o usuário',
  'notification': 'Alertas e notificações',
  
  // Business Logic
  'checkout': 'Fluxo de compra',
  'cart': 'Carrinho de compras',
  'login': 'Acesso ao sistema',
  'signup': 'Cadastro de novos usuários',
  'search': 'Busca de produtos/conteúdo',
};

function translateAreaToBusiness(area: string): string {
  const lowerArea = area.toLowerCase();
  
  for (const [key, translation] of Object.entries(RISK_AREA_BUSINESS_MAP)) {
    if (lowerArea.includes(key)) {
      return translation;
    }
  }
  
  return area;
}

// =============================================================================
// UX Severity Mapping
// =============================================================================

function mapRiskToUXSeverity(level: RiskLevel): UXImpactItem['severity'] {
  switch (level) {
    case 'critical': return 'blocking';
    case 'high': return 'frustrating';
    case 'medium': return 'annoying';
    case 'low': return 'minor';
  }
}

function mapRiskToUrgency(level: RiskLevel): BusinessRisk['urgency'] {
  switch (level) {
    case 'critical': return 'immediate';
    case 'high': return 'short-term';
    case 'medium': return 'short-term';
    case 'low': return 'long-term';
  }
}

// =============================================================================
// Generate Product Impact Report
// =============================================================================

export function generateProductImpactReport(
  analysis: AnalysisResult,
  context?: {
    analysisId?: string;
    prNumber?: number;
    repository?: string;
  }
): ProductImpactReport {
  const now = new Date().toISOString();

  // 1. Generate UX impact items from risks
  const uxImpact = extractUXImpacts(analysis);

  // 2. Translate risks to business language
  const businessRisks = translateRisksToBusinessLanguage(analysis.risks);

  // 3. Generate recommendations
  const recommendations = generateRecommendations(analysis, uxImpact, businessRisks);

  // 4. Calculate product health
  const productHealth = calculateProductHealth(analysis);

  // 5. Generate executive summary
  const executiveSummary = generateExecutiveSummary(analysis, uxImpact, businessRisks, productHealth);

  // 6. Merge decision in business language
  const mergeDecision = translateMergeDecision(analysis);

  const report: ProductImpactReport = {
    generatedAt: now,
    analysisId: context?.analysisId,
    prNumber: context?.prNumber,
    repository: context?.repository,
    executiveSummary,
    productHealth,
    mergeDecision,
    uxImpact,
    businessRisks,
    recommendations,
    metricsSummary: {
      totalRisks: analysis.risks.length,
      criticalRisks: analysis.risks.filter(r => r.level === 'critical').length,
      uxIssues: uxImpact.length,
      testScenarios: analysis.scenarios.length,
      coverageGaps: analysis.gaps.length,
      riskScore: analysis.riskScore,
    },
  };

  logger.info({
    uxIssues: uxImpact.length,
    businessRisks: businessRisks.length,
    recommendations: recommendations.length,
    productHealthScore: productHealth.score,
  }, 'Product impact report generated');

  return report;
}

// =============================================================================
// UX Impact Extraction
// =============================================================================

function extractUXImpacts(analysis: AnalysisResult): UXImpactItem[] {
  const impacts: UXImpactItem[] = [];

  for (const risk of analysis.risks) {
    // Check if risk has UX implications
    const isUXRelated = isRiskUXRelated(risk);
    
    if (isUXRelated) {
      impacts.push({
        area: translateAreaToBusiness(risk.area),
        issue: risk.title || risk.description.substring(0, 80),
        userImpact: generateUserImpactDescription(risk),
        severity: mapRiskToUXSeverity(risk.level),
        metric: estimateUXMetric(risk),
        affectedJourneys: extractAffectedJourneys(risk, analysis),
      });
    }
  }

  // Also extract UX issues from gaps
  for (const gap of analysis.gaps) {
    const gapLower = (gap.title + ' ' + gap.recommendation).toLowerCase();
    if (isTextUXRelated(gapLower)) {
      impacts.push({
        area: 'Experiência do Usuário',
        issue: gap.title,
        userImpact: gap.recommendation,
        severity: mapRiskToUXSeverity(gap.severity),
        affectedJourneys: [],
      });
    }
  }

  // Sort by severity
  const severityOrder = { blocking: 0, frustrating: 1, annoying: 2, minor: 3 };
  return impacts.sort((a, b) => severityOrder[a.severity] - severityOrder[b.severity]);
}

function isRiskUXRelated(risk: RiskAssessment): boolean {
  const text = `${risk.area} ${risk.title} ${risk.description} ${risk.impact || ''}`.toLowerCase();
  return isTextUXRelated(text);
}

function isTextUXRelated(text: string): boolean {
  const uxKeywords = [
    'usuário', 'user', 'ux', 'ui', 'interface', 'tela', 'screen',
    'fluxo', 'flow', 'navegação', 'navigation', 'formulário', 'form',
    'botão', 'button', 'loading', 'carregamento', 'feedback',
    'mensagem', 'message', 'erro visível', 'visible error',
    'experiência', 'experience', 'usabilidade', 'usability',
    'acessibilidade', 'accessibility', 'responsivo', 'responsive',
    'layout', 'design', 'visual', 'interação', 'interaction',
    'checkout', 'login', 'signup', 'cadastro', 'pagamento', 'payment',
    'carrinho', 'cart', 'busca', 'search', 'modal', 'popup',
    'tooltip', 'dropdown', 'menu', 'sidebar', 'header', 'footer',
    'abandono', 'abandonment', 'conversão', 'conversion',
    'retenção', 'retention', 'confus', 'passo extra', 'extra step',
  ];
  
  return uxKeywords.some(kw => text.includes(kw));
}

function generateUserImpactDescription(risk: RiskAssessment): string {
  if (risk.impact) {
    return risk.impact;
  }

  // Generate from risk description
  const level = risk.level;
  const area = risk.area.toLowerCase();

  if (level === 'critical') {
    return `Usuário não consegue completar a ação em "${risk.area}". Funcionalidade completamente bloqueada.`;
  }
  if (level === 'high') {
    return `Usuário encontra dificuldade significativa em "${risk.area}". Pode desistir da tarefa.`;
  }
  if (area.includes('performance') || area.includes('loading')) {
    return `Usuário percebe lentidão ao usar "${risk.area}". Tempo de espera elevado.`;
  }
  
  return `Experiência do usuário afetada em "${risk.area}". ${risk.description.substring(0, 100)}`;
}

function estimateUXMetric(risk: RiskAssessment): string | undefined {
  const level = risk.level;
  const area = risk.area.toLowerCase();

  if (level === 'critical') {
    if (area.includes('checkout') || area.includes('payment')) {
      return 'Risco de abandono: +40-60%';
    }
    return 'Risco de abandono: +30-50%';
  }

  if (level === 'high') {
    if (area.includes('form') || area.includes('formulário')) {
      return 'Taxa de conclusão: -20-30%';
    }
    return 'Risco de abandono: +15-25%';
  }

  if (level === 'medium') {
    return 'Satisfação do usuário: -10-20%';
  }

  return undefined;
}

function extractAffectedJourneys(risk: RiskAssessment, analysis: AnalysisResult): string[] {
  const journeys: string[] = [];
  
  // Find related scenarios that map to user journeys
  for (const scenario of analysis.scenarios) {
    if (scenario.relatedRisks?.includes(risk.title) || 
        scenario.relatedRisks?.includes(risk.area) ||
        scenario.title.toLowerCase().includes(risk.area.toLowerCase())) {
      if (scenario.category === 'happy_path' || scenario.category === 'sad_path') {
        journeys.push(scenario.title);
      }
    }
  }

  return journeys.slice(0, 3); // Limit to 3 journeys
}

// =============================================================================
// Risk → Business Language Translation
// =============================================================================

function translateRisksToBusinessLanguage(risks: RiskAssessment[]): BusinessRisk[] {
  return risks
    .filter(r => r.level === 'critical' || r.level === 'high' || r.level === 'medium')
    .map(risk => ({
      title: risk.title || risk.area,
      businessImpact: translateRiskImpact(risk),
      affectedArea: translateAreaToBusiness(risk.area),
      urgency: mapRiskToUrgency(risk.level),
      originalRiskLevel: risk.level,
      actionRequired: translateMitigationToAction(risk),
    }))
    .sort((a, b) => {
      const urgencyOrder = { immediate: 0, 'short-term': 1, 'long-term': 2 };
      return urgencyOrder[a.urgency] - urgencyOrder[b.urgency];
    });
}

function translateRiskImpact(risk: RiskAssessment): string {
  if (risk.impact) {
    return risk.impact;
  }

  const area = risk.area.toLowerCase();
  const level = risk.level;

  if (level === 'critical') {
    if (area.includes('security') || area.includes('auth')) {
      return 'Vazamento de dados pode causar perda de confiança dos clientes e problemas legais (LGPD).';
    }
    if (area.includes('payment') || area.includes('checkout')) {
      return 'Falha no pagamento causa perda direta de receita e frustração do cliente.';
    }
    return `Funcionalidade crítica comprometida em "${risk.area}". Impacto direto na capacidade do usuário usar o sistema.`;
  }

  if (level === 'high') {
    return `${risk.area}: ${risk.description.substring(0, 120)}. Pode resultar em perda de usuários ou tickets de suporte.`;
  }

  return `${risk.area}: ${risk.description.substring(0, 120)}. Impacto moderado na experiência do usuário.`;
}

function translateMitigationToAction(risk: RiskAssessment): string {
  if (typeof risk.mitigation === 'object' && risk.mitigation.preventive) {
    return risk.mitigation.preventive;
  }
  if (typeof risk.mitigation === 'string') {
    return risk.mitigation;
  }
  
  switch (risk.level) {
    case 'critical':
      return 'Bloquear merge até correção. Prioridade P0.';
    case 'high':
      return 'Corrigir antes do release. Prioridade P1.';
    case 'medium':
      return 'Planejar correção para próxima sprint. Prioridade P2.';
    default:
      return 'Registrar para melhoria futura.';
  }
}

// =============================================================================
// Recommendations Generator
// =============================================================================

function generateRecommendations(
  analysis: AnalysisResult,
  uxImpacts: UXImpactItem[],
  businessRisks: BusinessRisk[]
): ProductRecommendation[] {
  const recommendations: ProductRecommendation[] = [];

  // Critical/blocking issues = must-do
  const blockingUX = uxImpacts.filter(u => u.severity === 'blocking');
  if (blockingUX.length > 0) {
    recommendations.push({
      priority: 'must-do',
      title: 'Resolver problemas bloqueantes de UX',
      description: `${blockingUX.length} problema(s) impedem o usuário de completar tarefas: ${blockingUX.map(u => u.area).join(', ')}.`,
      expectedOutcome: 'Restaurar funcionalidade completa para o usuário final.',
      effort: blockingUX.length > 2 ? 'high' : 'medium',
    });
  }

  // Security risks = must-do
  const securityRisks = businessRisks.filter(r => 
    r.affectedArea.toLowerCase().includes('segurança') || 
    r.affectedArea.toLowerCase().includes('confiança')
  );
  if (securityRisks.length > 0) {
    recommendations.push({
      priority: 'must-do',
      title: 'Corrigir vulnerabilidades de segurança',
      description: `${securityRisks.length} risco(s) de segurança identificado(s) que podem comprometer dados dos usuários.`,
      expectedOutcome: 'Proteger dados dos clientes e manter conformidade regulatória.',
      effort: 'medium',
    });
  }

  // High frustration items = should-do
  const frustrating = uxImpacts.filter(u => u.severity === 'frustrating');
  if (frustrating.length > 0) {
    recommendations.push({
      priority: 'should-do',
      title: 'Melhorar fluxos com alta fricção',
      description: `${frustrating.length} ponto(s) de fricção que podem causar abandono: ${frustrating.map(u => u.area).join(', ')}.`,
      expectedOutcome: 'Reduzir taxa de abandono e aumentar conclusão de tarefas.',
      effort: 'medium',
    });
  }

  // Coverage gaps = should-do
  if (analysis.gaps.length > 0) {
    const criticalGaps = analysis.gaps.filter(g => g.severity === 'critical' || g.severity === 'high');
    if (criticalGaps.length > 0) {
      recommendations.push({
        priority: 'should-do',
        title: 'Preencher lacunas de qualidade',
        description: `${criticalGaps.length} gap(s) de qualidade encontrado(s) que precisam de atenção: ${criticalGaps.map(g => g.title).slice(0, 3).join(', ')}.`,
        expectedOutcome: 'Evitar regressões e manter estabilidade do produto.',
        effort: criticalGaps.length > 3 ? 'high' : 'low',
      });
    }
  }

  // Test coverage = nice-to-have
  const uncovered = analysis.scenarios.filter(s => !s.automatedTest?.code);
  if (uncovered.length > 0) {
    recommendations.push({
      priority: 'nice-to-have',
      title: 'Aumentar cobertura de testes automatizados',
      description: `${uncovered.length} de ${analysis.scenarios.length} cenários sem teste automatizado.`,
      expectedOutcome: 'Maior confiança em deploys e detecção precoce de regressões.',
      effort: uncovered.length > 5 ? 'high' : 'medium',
    });
  }

  return recommendations;
}

// =============================================================================
// Product Health Calculator
// =============================================================================

function calculateProductHealth(analysis: AnalysisResult): ProductImpactReport['productHealth'] {
  // Start at 100 and deduct based on issues
  let score = 100;

  // Critical risks heavily impact product health
  const criticalCount = analysis.risks.filter(r => r.level === 'critical').length;
  const highCount = analysis.risks.filter(r => r.level === 'high').length;
  const mediumCount = analysis.risks.filter(r => r.level === 'medium').length;

  score -= criticalCount * 25;
  score -= highCount * 10;
  score -= mediumCount * 3;

  // Gaps also impact
  const criticalGaps = analysis.gaps.filter(g => g.severity === 'critical').length;
  score -= criticalGaps * 10;

  // Ensure bounds
  score = Math.max(0, Math.min(100, score));

  let status: ProductImpactReport['productHealth']['status'];
  if (score >= 80) status = 'healthy';
  else if (score >= 60) status = 'attention';
  else if (score >= 40) status = 'degraded';
  else status = 'critical';

  let trend = 'estável';
  if (criticalCount > 0) trend = 'degradando';
  else if (analysis.risks.length === 0) trend = 'melhorando';

  return { score, status, trend };
}

// =============================================================================
// Executive Summary Generator
// =============================================================================

function generateExecutiveSummary(
  analysis: AnalysisResult,
  uxImpacts: UXImpactItem[],
  businessRisks: BusinessRisk[],
  productHealth: ProductImpactReport['productHealth']
): string {
  const parts: string[] = [];

  // Product impact from LLM
  if (analysis.productImpact) {
    parts.push(analysis.productImpact);
  } else {
    // Generate based on data
    if (productHealth.status === 'critical') {
      parts.push(`⚠️ Esta mudança apresenta riscos críticos que podem impactar diretamente a experiência dos usuários.`);
    } else if (productHealth.status === 'degraded') {
      parts.push(`Esta mudança contém riscos que precisam de atenção antes de ir para produção.`);
    } else if (productHealth.status === 'attention') {
      parts.push(`Mudança com impacto moderado. Alguns pontos de atenção identificados.`);
    } else {
      parts.push(`Mudança de baixo impacto no produto. Nenhum risco significativo para os usuários.`);
    }
  }

  // Key numbers
  const immediateRisks = businessRisks.filter(r => r.urgency === 'immediate').length;
  if (immediateRisks > 0) {
    parts.push(`${immediateRisks} risco(s) requer(em) ação imediata.`);
  }

  const blockingUX = uxImpacts.filter(u => u.severity === 'blocking').length;
  if (blockingUX > 0) {
    parts.push(`${blockingUX} problema(s) bloqueante(s) de UX detectado(s).`);
  }

  return parts.join(' ');
}

// =============================================================================
// Merge Decision Translation
// =============================================================================

function translateMergeDecision(analysis: AnalysisResult): ProductImpactReport['mergeDecision'] {
  const rec = analysis.mergeRecommendation || 'attention';
  const info = MERGE_RECOMMENDATION_LABELS[rec];

  let reason: string;
  switch (rec) {
    case 'merge_ok':
      reason = 'Nenhum impacto significativo no produto. Seguro para deploy.';
      break;
    case 'attention':
      reason = 'Pontos de atenção que podem afetar a experiência do usuário. Recomenda-se revisão antes do deploy.';
      break;
    case 'block':
      reason = 'Riscos que podem prejudicar o produto ou a experiência do usuário. Correção obrigatória antes do deploy.';
      break;
    default:
      reason = 'Avaliação pendente.';
  }

  return {
    recommendation: rec,
    emoji: info.emoji,
    label: info.labelPtBr,
    reason,
  };
}

// =============================================================================
// Markdown Export (for sharing with PM/CTO)
// =============================================================================

export function formatProductImpactMarkdown(report: ProductImpactReport): string {
  const sections: string[] = [];

  // Header
  sections.push('# 📊 Relatório de Impacto no Produto');
  sections.push('');
  sections.push(`*Gerado por Keelo em ${new Date(report.generatedAt).toLocaleDateString('pt-BR')}*`);
  if (report.repository && report.prNumber) {
    sections.push(`*Repositório: ${report.repository} | PR #${report.prNumber}*`);
  }
  sections.push('');

  // Decision Banner
  sections.push('---');
  sections.push(`## ${report.mergeDecision.emoji} ${report.mergeDecision.label}`);
  sections.push('');
  sections.push(`> ${report.mergeDecision.reason}`);
  sections.push('');

  // Executive Summary
  sections.push('## 📋 Resumo Executivo');
  sections.push('');
  sections.push(report.executiveSummary);
  sections.push('');

  // Product Health
  const healthEmoji = {
    healthy: '💚',
    attention: '💛',
    degraded: '🧡',
    critical: '❤️',
  };
  sections.push('## 🏥 Saúde do Produto');
  sections.push('');
  sections.push(`| Indicador | Valor |`);
  sections.push(`|-----------|-------|`);
  sections.push(`| ${healthEmoji[report.productHealth.status]} Saúde | **${report.productHealth.score}/100** (${report.productHealth.status}) |`);
  sections.push(`| 📈 Tendência | ${report.productHealth.trend} |`);
  sections.push(`| ⚠️ Riscos totais | ${report.metricsSummary.totalRisks} |`);
  sections.push(`| 🔴 Riscos críticos | ${report.metricsSummary.criticalRisks} |`);
  sections.push(`| 🎯 Cenários de teste | ${report.metricsSummary.testScenarios} |`);
  sections.push('');

  // UX Impact
  if (report.uxImpact.length > 0) {
    sections.push('## 🎨 Impacto na Experiência do Usuário');
    sections.push('');
    
    const severityEmoji = {
      blocking: '🚫',
      frustrating: '😤',
      annoying: '😕',
      minor: '💡',
    };

    for (const impact of report.uxImpact) {
      sections.push(`### ${severityEmoji[impact.severity]} ${impact.area}`);
      sections.push('');
      sections.push(`**Problema:** ${impact.issue}`);
      sections.push('');
      sections.push(`**Impacto no usuário:** ${impact.userImpact}`);
      if (impact.metric) {
        sections.push(`**Métrica estimada:** ${impact.metric}`);
      }
      if (impact.affectedJourneys.length > 0) {
        sections.push(`**Jornadas afetadas:** ${impact.affectedJourneys.join(', ')}`);
      }
      sections.push('');
    }
  }

  // Business Risks
  if (report.businessRisks.length > 0) {
    sections.push('## 💼 Riscos de Negócio');
    sections.push('');
    sections.push('| Urgência | Risco | Impacto | Ação |');
    sections.push('|----------|-------|---------|------|');
    
    const urgencyEmoji = { immediate: '🔴', 'short-term': '🟡', 'long-term': '🟢' };
    const urgencyLabel = { immediate: 'Imediata', 'short-term': 'Curto prazo', 'long-term': 'Longo prazo' };
    
    for (const risk of report.businessRisks) {
      sections.push(`| ${urgencyEmoji[risk.urgency]} ${urgencyLabel[risk.urgency]} | ${risk.title} | ${risk.businessImpact.substring(0, 80)} | ${risk.actionRequired.substring(0, 60)} |`);
    }
    sections.push('');
  }

  // Recommendations
  if (report.recommendations.length > 0) {
    sections.push('## ✅ Recomendações');
    sections.push('');
    
    const priorityEmoji = { 'must-do': '🔴', 'should-do': '🟡', 'nice-to-have': '🟢' };
    const priorityLabel = { 'must-do': 'Obrigatório', 'should-do': 'Recomendado', 'nice-to-have': 'Desejável' };
    
    for (const rec of report.recommendations) {
      sections.push(`### ${priorityEmoji[rec.priority]} ${rec.title} (${priorityLabel[rec.priority]})`);
      sections.push('');
      sections.push(rec.description);
      sections.push(`**Resultado esperado:** ${rec.expectedOutcome}`);
      sections.push(`**Esforço estimado:** ${rec.effort}`);
      sections.push('');
    }
  }

  // Footer
  sections.push('---');
  sections.push('*Relatório gerado automaticamente pelo Keelo - Agente Autônomo de QA*');
  sections.push('*Dados baseados em análise estática de código e IA. Validação humana recomendada.*');

  return sections.join('\n');
}

// =============================================================================
// Slack Product Impact Format
// =============================================================================

export function buildProductImpactSlackMessage(report: ProductImpactReport): {
  text: string;
  blocks: Array<{
    type: string;
    text?: { type: string; text: string; emoji?: boolean };
    fields?: Array<{ type: string; text: string }>;
    elements?: unknown[];
  }>;
} {
  const healthEmoji = {
    healthy: '💚',
    attention: '💛',
    degraded: '🧡',
    critical: '❤️',
  };

  const blocks: Array<{
    type: string;
    text?: { type: string; text: string; emoji?: boolean };
    fields?: Array<{ type: string; text: string }>;
    elements?: unknown[];
  }> = [];

  // Header
  blocks.push({
    type: 'header',
    text: {
      type: 'plain_text',
      text: `${report.mergeDecision.emoji} Keelo - Impacto no Produto`,
      emoji: true,
    },
  });

  // PR info
  if (report.repository && report.prNumber) {
    blocks.push({
      type: 'section',
      fields: [
        { type: 'mrkdwn', text: `*Repositório:*\n${report.repository}` },
        { type: 'mrkdwn', text: `*PR:*\n#${report.prNumber}` },
      ],
    });
  }

  // Decision
  blocks.push({
    type: 'section',
    text: {
      type: 'mrkdwn',
      text: `*${report.mergeDecision.emoji} Decisão: ${report.mergeDecision.label}*\n${report.mergeDecision.reason}`,
    },
  });

  // Product Health
  blocks.push({
    type: 'section',
    fields: [
      { type: 'mrkdwn', text: `*${healthEmoji[report.productHealth.status]} Saúde do Produto:*\n${report.productHealth.score}/100 (${report.productHealth.status})` },
      { type: 'mrkdwn', text: `*📊 Risk Score:*\n${report.metricsSummary.riskScore}/100` },
    ],
  });

  // Executive Summary
  blocks.push({
    type: 'section',
    text: {
      type: 'mrkdwn',
      text: `*📋 Resumo:*\n${report.executiveSummary}`,
    },
  });

  // Key UX issues (if any)
  if (report.uxImpact.length > 0) {
    const topIssues = report.uxImpact.slice(0, 3);
    let uxText = '*🎨 Impacto UX:*\n';
    for (const impact of topIssues) {
      const severityEmoji = { blocking: '🚫', frustrating: '😤', annoying: '😕', minor: '💡' };
      uxText += `${severityEmoji[impact.severity]} ${impact.area}: ${impact.issue}\n`;
      if (impact.metric) {
        uxText += `  _${impact.metric}_\n`;
      }
    }
    blocks.push({
      type: 'section',
      text: { type: 'mrkdwn', text: uxText },
    });
  }

  // Quick stats
  blocks.push({
    type: 'section',
    fields: [
      { type: 'mrkdwn', text: `*⚠️ Riscos:*\n${report.metricsSummary.totalRisks} (${report.metricsSummary.criticalRisks} críticos)` },
      { type: 'mrkdwn', text: `*🧪 Cenários:*\n${report.metricsSummary.testScenarios}` },
    ],
  });

  // Top recommendations
  if (report.recommendations.length > 0) {
    const mustDo = report.recommendations.filter(r => r.priority === 'must-do');
    if (mustDo.length > 0) {
      let recText = '*🔴 Ações Obrigatórias:*\n';
      for (const rec of mustDo) {
        recText += `• ${rec.title}\n`;
      }
      blocks.push({
        type: 'section',
        text: { type: 'mrkdwn', text: recText },
      });
    }
  }

  return {
    text: `${report.mergeDecision.emoji} Keelo - Impacto no Produto | ${report.productHealth.score}/100`,
    blocks,
  };
}

