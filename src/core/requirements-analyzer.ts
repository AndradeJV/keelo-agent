import { logger, keeloConfig, SYSTEM_PROMPT } from '../config/index.js';
import { callLLM } from './llm.js';
import { figma } from '../integrations/index.js';
import type { TestScenario, RiskLevel } from './types.js';

// =============================================================================
// Types
// =============================================================================

export interface RequirementsInput {
  /** URL ou imagem base64 do Figma/design */
  figmaUrl?: string;
  figmaImage?: string;
  
  /** Texto com requisitos (história de usuário, critérios, etc.) */
  requirements?: string;
  
  /** Conteúdo extraído de PDF */
  pdfContent?: string;
  
  /** Metadados opcionais */
  metadata?: {
    projectName?: string;
    featureName?: string;
    sprint?: string;
    priority?: 'high' | 'medium' | 'low';
  };
}

export interface RequirementsAnalysisResult {
  version: string;
  analyzedAt: string;
  
  /** Resumo da análise */
  summary: {
    title: string;
    description: string;
    scope: string[];
    complexity: 'low' | 'medium' | 'high';
  };
  
  /** Cenários de teste gerados */
  scenarios: PreImplementationScenario[];
  
  /** Critérios de aceite extraídos/sugeridos */
  acceptanceCriteria: AcceptanceCriteria[];
  
  /** Riscos identificados */
  risks: RequirementRisk[];
  
  /** Gaps nos requisitos */
  gaps: RequirementGap[];
  
  /** Sugestões de melhoria */
  suggestions: string[];
  
  /** Análise de UI (se Figma foi fornecido) */
  uiAnalysis?: UIAnalysis;
  
  /** Prompt para implementação dos cenários */
  implementationPrompt?: string;
  
  /** Dados brutos da análise */
  raw: string;
}

export interface PreImplementationScenario extends Omit<TestScenario, 'testType'> {
  /** Tipo de teste sugerido */
  suggestedTestType: 'unit' | 'integration' | 'e2e' | 'manual';
  
  /** Dados de teste sugeridos */
  testData?: string[];
  
  /** Dependências/pré-requisitos */
  dependencies?: string[];
  
  /** Estimativa de esforço */
  effort: 'low' | 'medium' | 'high';
}

export interface AcceptanceCriteria {
  id: string;
  description: string;
  type: 'functional' | 'non-functional' | 'ux' | 'accessibility';
  gherkin?: {
    given: string;
    when: string;
    then: string;
  };
  automatable: boolean;
}

export interface RequirementRisk {
  title: string;
  description: string;
  severity: RiskLevel;
  mitigation: string;
  affectedAreas: string[];
}

export interface RequirementGap {
  title: string;
  description: string;
  type: 
    | 'missing_info'           // Informação faltando
    | 'ambiguity'              // Requisito ambíguo
    | 'contradiction'          // Contradição entre requisitos
    | 'edge_case'              // Caso de borda não coberto
    | 'dangerous_assumption'   // Hipótese perigosa/não validada
    | 'implicit_criterion'     // Critério implícito não documentado
    | 'unclear_behavior';      // Comportamento esperado não claro
  question: string;            // Pergunta para o PO/analista
  severity: RiskLevel;
  recommendation?: string;     // Sugestão de como resolver
}

export interface UIAnalysis {
  components: UIComponent[];
  flows: UIFlow[];
  accessibilityIssues: AccessibilityIssue[];
  interactions: UIInteraction[];
}

export interface UIComponent {
  name: string;
  type: 'button' | 'input' | 'form' | 'modal' | 'list' | 'card' | 'navigation' | 'other';
  states: string[];
  validations?: string[];
}

export interface UIFlow {
  name: string;
  steps: string[];
  happyPath: boolean;
}

export interface AccessibilityIssue {
  element: string;
  issue: string;
  wcagLevel: 'A' | 'AA' | 'AAA';
  suggestion: string;
}

export interface UIInteraction {
  element: string;
  action: string;
  expectedResult: string;
}

// =============================================================================
// Validation
// =============================================================================

export function validateRequirementsInput(input: RequirementsInput): { 
  valid: boolean; 
  errors: string[] 
} {
  const errors: string[] = [];
  
  const hasInput = !!(
    input.figmaUrl || 
    input.figmaImage || 
    input.requirements || 
    input.pdfContent
  );
  
  if (!hasInput) {
    errors.push('Pelo menos uma fonte de requisitos deve ser fornecida (figmaUrl, figmaImage, requirements ou pdfContent)');
  }
  
  if (input.figmaUrl && !isValidUrl(input.figmaUrl)) {
    errors.push('figmaUrl deve ser uma URL válida');
  }
  
  if (input.figmaImage && !isValidBase64Image(input.figmaImage)) {
    errors.push('figmaImage deve ser uma imagem base64 válida');
  }
  
  return { valid: errors.length === 0, errors };
}

function isValidUrl(url: string): boolean {
  try {
    new URL(url);
    return true;
  } catch {
    return false;
  }
}

function isValidBase64Image(base64: string): boolean {
  return /^data:image\/(png|jpeg|jpg|gif|webp);base64,/.test(base64) || 
         /^[A-Za-z0-9+/=]+$/.test(base64);
}

// =============================================================================
// Main Analysis Function
// =============================================================================

export async function analyzeRequirements(
  input: RequirementsInput
): Promise<RequirementsAnalysisResult> {
  const validation = validateRequirementsInput(input);
  if (!validation.valid) {
    throw new Error(`Input inválido: ${validation.errors.join(', ')}`);
  }

  // Auto-fetch Figma image if URL provided but no image
  if (input.figmaUrl && !input.figmaImage) {
    if (figma.isFigmaConfigured()) {
      try {
        logger.info({ url: input.figmaUrl }, 'Auto-fetching Figma design...');
        const figmaData = await figma.fetchDesignFromUrl(input.figmaUrl);
        input.figmaImage = figmaData.imageBase64;
        logger.info({ fileName: figmaData.fileInfo.name }, 'Figma design loaded successfully');
      } catch (error) {
        logger.warn({ error, url: input.figmaUrl }, 'Failed to fetch Figma design, continuing without image');
      }
    } else {
      logger.warn('Figma URL provided but FIGMA_ACCESS_TOKEN not configured. Set it in .env to auto-fetch designs.');
    }
  }

  logger.info({
    hasFigma: !!(input.figmaUrl || input.figmaImage),
    hasRequirements: !!input.requirements,
    hasPdf: !!input.pdfContent,
  }, 'Iniciando análise de requisitos');

  const systemPrompt = buildRequirementsSystemPrompt();
  const userPrompt = buildRequirementsUserPrompt(input);

  // Se tem imagem do Figma, usar análise com visão
  const hasImage = !!input.figmaImage;
  
  const content = await callLLM({
    systemPrompt,
    userPrompt,
    jsonMode: true,
    imageBase64: hasImage ? input.figmaImage : undefined,
  });

  const result = parseRequirementsResponse(content, input);
  
  // Generate implementation prompt
  result.implementationPrompt = generateImplementationPrompt(result, input);
  
  logger.info({
    scenarios: result.scenarios.length,
    criteria: result.acceptanceCriteria.length,
    risks: result.risks.length,
    gaps: result.gaps.length,
  }, 'Análise de requisitos concluída');

  return result;
}

// =============================================================================
// Prompt Building
// =============================================================================

function buildRequirementsSystemPrompt(): string {
  const lang = keeloConfig.language;
  
  const prompts = {
    'pt-br': `Você é um analista de QA sênior especializado em análise de requisitos e criação de cenários de teste.

Sua tarefa é analisar requisitos de software (histórias de usuário, designs, documentos) e gerar:
1. Cenários de teste detalhados ANTES da implementação
2. Critérios de aceite no formato Gherkin
3. Riscos e gaps nos requisitos
4. Sugestões de melhoria

## Diretrizes

### Cenários de Teste
- Use taxonomia de cenários: happy_path, sad_path, edge_case, boundary, security, accessibility
- Inclua pré-condições, passos e resultado esperado
- Sugira dados de teste
- Estime esforço de automação

### Critérios de Aceite
- Gere no formato Gherkin (Given/When/Then)
- Identifique critérios funcionais e não-funcionais
- Marque quais são automatizáveis

### Análise de UI (se imagem fornecida)
- Identifique componentes e seus estados
- Mapeie fluxos de navegação
- Aponte problemas de acessibilidade
- Liste interações necessárias

### Análise Crítica de Requisitos (GAPS)

Identifique TODOS os problemas potenciais nos requisitos:

| Tipo | O que buscar |
|------|--------------|
| **missing_info** | Informações que deveriam estar documentadas mas não estão |
| **ambiguity** | Requisitos que podem ser interpretados de formas diferentes |
| **contradiction** | Conflitos entre requisitos ou com comportamentos existentes |
| **edge_case** | Casos de borda não cobertos pela especificação |
| **dangerous_assumption** | Suposições implícitas que podem estar erradas (ex: "usuário sempre terá internet") |
| **implicit_criterion** | Critérios que todos assumem mas ninguém documentou (ex: "senha mínima de 8 caracteres") |
| **unclear_behavior** | Comportamento esperado que não está claro (ex: "o que acontece se X?") |

Para CADA gap, inclua:
- **question**: Pergunta específica para o PO/analista responder
- **recommendation**: Sugestão de como resolver

Responda APENAS em JSON válido seguindo a estrutura especificada.`,

    'en': `You are a senior QA analyst specialized in requirements analysis and test scenario creation.

Your task is to analyze software requirements (user stories, designs, documents) and generate:
1. Detailed test scenarios BEFORE implementation
2. Acceptance criteria in Gherkin format
3. Risks and gaps in requirements
4. Improvement suggestions

## Guidelines

### Test Scenarios
- Use scenario taxonomy: happy_path, sad_path, edge_case, boundary, security, accessibility
- Include preconditions, steps, and expected results
- Suggest test data
- Estimate automation effort

### Acceptance Criteria
- Generate in Gherkin format (Given/When/Then)
- Identify functional and non-functional criteria
- Mark which ones are automatable

### UI Analysis (if image provided)
- Identify components and their states
- Map navigation flows
- Point out accessibility issues
- List required interactions

### Critical Requirements Analysis (GAPS)

Identify ALL potential issues in the requirements:

| Type | What to look for |
|------|------------------|
| **missing_info** | Information that should be documented but isn't |
| **ambiguity** | Requirements that can be interpreted in different ways |
| **contradiction** | Conflicts between requirements or with existing behavior |
| **edge_case** | Edge cases not covered by the specification |
| **dangerous_assumption** | Implicit assumptions that may be wrong (e.g., "user will always have internet") |
| **implicit_criterion** | Criteria everyone assumes but nobody documented (e.g., "password min 8 chars") |
| **unclear_behavior** | Expected behavior that is not clear (e.g., "what happens if X?") |

For EACH gap, include:
- **question**: Specific question for the PO/analyst to answer
- **recommendation**: Suggestion on how to resolve

Respond ONLY in valid JSON following the specified structure.`,
  };

  return prompts[lang] || prompts['en'];
}

function buildRequirementsUserPrompt(input: RequirementsInput): string {
  const sections: string[] = [];
  
  sections.push('## Análise de Requisitos\n');
  
  if (input.metadata) {
    sections.push('### Metadados');
    if (input.metadata.projectName) sections.push(`- **Projeto:** ${input.metadata.projectName}`);
    if (input.metadata.featureName) sections.push(`- **Feature:** ${input.metadata.featureName}`);
    if (input.metadata.sprint) sections.push(`- **Sprint:** ${input.metadata.sprint}`);
    if (input.metadata.priority) sections.push(`- **Prioridade:** ${input.metadata.priority}`);
    sections.push('');
  }
  
  if (input.requirements) {
    sections.push('### Requisitos / História de Usuário\n');
    sections.push(input.requirements);
    sections.push('');
  }
  
  if (input.pdfContent) {
    sections.push('### Conteúdo do Documento (PDF)\n');
    sections.push(input.pdfContent.substring(0, 10000)); // Limitar tamanho
    sections.push('');
  }
  
  if (input.figmaUrl) {
    sections.push(`### Design (Figma)\n`);
    sections.push(`URL: ${input.figmaUrl}`);
    sections.push('');
  }
  
  if (input.figmaImage) {
    sections.push('### Design (Imagem anexada)\n');
    sections.push('Analise a imagem do design fornecida.');
    sections.push('');
  }
  
  sections.push(`
### Estrutura de Resposta Esperada

\`\`\`json
{
  "summary": {
    "title": "string",
    "description": "string",
    "scope": ["string"],
    "complexity": "low|medium|high"
  },
  "scenarios": [
    {
      "id": "TC001",
      "title": "string",
      "category": "happy_path|sad_path|edge_case|boundary|security|accessibility",
      "priority": "critical|high|medium|low",
      "preconditions": ["string"],
      "steps": ["string"],
      "expectedResult": "string",
      "suggestedTestType": "unit|integration|e2e|manual",
      "testData": ["string"],
      "dependencies": ["string"],
      "effort": "low|medium|high"
    }
  ],
  "acceptanceCriteria": [
    {
      "id": "AC001",
      "description": "string",
      "type": "functional|non-functional|ux|accessibility",
      "gherkin": {
        "given": "string",
        "when": "string",
        "then": "string"
      },
      "automatable": true
    }
  ],
  "risks": [
    {
      "title": "string",
      "description": "string",
      "severity": "critical|high|medium|low",
      "mitigation": "string",
      "affectedAreas": ["string"]
    }
  ],
  "gaps": [
    {
      "title": "string",
      "description": "string",
      "type": "missing_info|ambiguity|contradiction|edge_case|dangerous_assumption|implicit_criterion|unclear_behavior",
      "question": "string",
      "severity": "critical|high|medium|low",
      "recommendation": "string (opcional)"
    }
  ],
  "suggestions": ["string"],
  "uiAnalysis": {
    "components": [
      {
        "name": "string",
        "type": "button|input|form|modal|list|card|navigation|other",
        "states": ["string"],
        "validations": ["string"]
      }
    ],
    "flows": [
      {
        "name": "string",
        "steps": ["string"],
        "happyPath": true
      }
    ],
    "accessibilityIssues": [
      {
        "element": "string",
        "issue": "string",
        "wcagLevel": "A|AA|AAA",
        "suggestion": "string"
      }
    ],
    "interactions": [
      {
        "element": "string",
        "action": "string",
        "expectedResult": "string"
      }
    ]
  }
}
\`\`\`

Gere cenários de teste completos e detalhados para todos os requisitos identificados.
`);

  return sections.join('\n');
}

// =============================================================================
// Response Parsing
// =============================================================================

function parseRequirementsResponse(
  content: string, 
  input: RequirementsInput
): RequirementsAnalysisResult {
  const now = new Date().toISOString();
  
  try {
    const parsed = JSON.parse(content);
    
    return {
      version: '1.0.0',
      analyzedAt: now,
      summary: {
        title: parsed.summary?.title || 'Análise de Requisitos',
        description: parsed.summary?.description || '',
        scope: Array.isArray(parsed.summary?.scope) ? parsed.summary.scope : [],
        complexity: validateComplexity(parsed.summary?.complexity),
      },
      scenarios: Array.isArray(parsed.scenarios) 
        ? parsed.scenarios.map(normalizePreImplScenario) 
        : [],
      acceptanceCriteria: Array.isArray(parsed.acceptanceCriteria)
        ? parsed.acceptanceCriteria.map(normalizeAcceptanceCriteria)
        : [],
      risks: Array.isArray(parsed.risks)
        ? parsed.risks.map(normalizeRequirementRisk)
        : [],
      gaps: Array.isArray(parsed.gaps)
        ? parsed.gaps.map(normalizeRequirementGap)
        : [],
      suggestions: Array.isArray(parsed.suggestions) ? parsed.suggestions : [],
      uiAnalysis: input.figmaImage || input.figmaUrl 
        ? normalizeUIAnalysis(parsed.uiAnalysis) 
        : undefined,
      raw: content,
    };
  } catch (error) {
    logger.error({ error, content: content.substring(0, 500) }, 'Falha ao parsear resposta');
    
    return {
      version: '1.0.0',
      analyzedAt: now,
      summary: {
        title: 'Análise falhou',
        description: 'Não foi possível parsear a resposta da IA',
        scope: [],
        complexity: 'medium',
      },
      scenarios: [],
      acceptanceCriteria: [],
      risks: [],
      gaps: [],
      suggestions: [],
      raw: content,
    };
  }
}

function validateComplexity(value: unknown): 'low' | 'medium' | 'high' {
  const valid = ['low', 'medium', 'high'];
  return valid.includes(value as string) ? (value as 'low' | 'medium' | 'high') : 'medium';
}

function validateRiskLevel(level: unknown): RiskLevel {
  const valid: RiskLevel[] = ['critical', 'high', 'medium', 'low'];
  return valid.includes(level as RiskLevel) ? (level as RiskLevel) : 'medium';
}

function normalizePreImplScenario(s: Record<string, unknown>, index: number): PreImplementationScenario {
  return {
    id: String(s.id || `TC${String(index + 1).padStart(3, '0')}`),
    title: String(s.title || ''),
    category: s.category as PreImplementationScenario['category'] || 'happy_path',
    priority: validateRiskLevel(s.priority),
    preconditions: Array.isArray(s.preconditions) ? s.preconditions : [],
    steps: Array.isArray(s.steps) ? s.steps : [],
    expectedResult: String(s.expectedResult || ''),
    suggestedTestType: s.suggestedTestType as PreImplementationScenario['suggestedTestType'] || 'e2e',
    testData: Array.isArray(s.testData) ? s.testData : undefined,
    dependencies: Array.isArray(s.dependencies) ? s.dependencies : undefined,
    effort: validateComplexity(s.effort) as PreImplementationScenario['effort'],
    heuristic: s.heuristic as PreImplementationScenario['heuristic'],
  };
}

function normalizeAcceptanceCriteria(ac: Record<string, unknown>, index: number): AcceptanceCriteria {
  const gherkin = ac.gherkin as Record<string, unknown> | undefined;
  
  return {
    id: String(ac.id || `AC${String(index + 1).padStart(3, '0')}`),
    description: String(ac.description || ''),
    type: ac.type as AcceptanceCriteria['type'] || 'functional',
    gherkin: gherkin ? {
      given: String(gherkin.given || ''),
      when: String(gherkin.when || ''),
      then: String(gherkin.then || ''),
    } : undefined,
    automatable: Boolean(ac.automatable),
  };
}

function normalizeRequirementRisk(r: Record<string, unknown>): RequirementRisk {
  return {
    title: String(r.title || ''),
    description: String(r.description || ''),
    severity: validateRiskLevel(r.severity),
    mitigation: String(r.mitigation || ''),
    affectedAreas: Array.isArray(r.affectedAreas) ? r.affectedAreas : [],
  };
}

function normalizeRequirementGap(g: Record<string, unknown>): RequirementGap {
  return {
    title: String(g.title || ''),
    description: String(g.description || ''),
    type: g.type as RequirementGap['type'] || 'missing_info',
    question: String(g.question || ''),
    severity: validateRiskLevel(g.severity),
  };
}

function normalizeUIAnalysis(ui: Record<string, unknown> | undefined): UIAnalysis | undefined {
  if (!ui) return undefined;
  
  return {
    components: Array.isArray(ui.components) 
      ? ui.components.map((c: Record<string, unknown>) => ({
          name: String(c.name || ''),
          type: c.type as UIComponent['type'] || 'other',
          states: Array.isArray(c.states) ? c.states : [],
          validations: Array.isArray(c.validations) ? c.validations : undefined,
        }))
      : [],
    flows: Array.isArray(ui.flows)
      ? ui.flows.map((f: Record<string, unknown>) => ({
          name: String(f.name || ''),
          steps: Array.isArray(f.steps) ? f.steps : [],
          happyPath: Boolean(f.happyPath),
        }))
      : [],
    accessibilityIssues: Array.isArray(ui.accessibilityIssues)
      ? ui.accessibilityIssues.map((a: Record<string, unknown>) => ({
          element: String(a.element || ''),
          issue: String(a.issue || ''),
          wcagLevel: a.wcagLevel as AccessibilityIssue['wcagLevel'] || 'AA',
          suggestion: String(a.suggestion || ''),
        }))
      : [],
    interactions: Array.isArray(ui.interactions)
      ? ui.interactions.map((i: Record<string, unknown>) => ({
          element: String(i.element || ''),
          action: String(i.action || ''),
          expectedResult: String(i.expectedResult || ''),
        }))
      : [],
  };
}

// =============================================================================
// Formatting
// =============================================================================

export function formatRequirementsAnalysis(result: RequirementsAnalysisResult): string {
  const lines: string[] = [];
  const lang = keeloConfig.language;
  
  const i18n = {
    'pt-br': {
      header: '## 🎯 Análise de Requisitos - Keelo',
      summary: 'Resumo',
      complexity: 'Complexidade',
      scope: 'Escopo',
      scenarios: 'Cenários de Teste',
      criteria: 'Critérios de Aceite',
      risks: 'Riscos Identificados',
      gaps: 'Gaps nos Requisitos',
      suggestions: 'Sugestões',
      uiAnalysis: 'Análise de UI',
      components: 'Componentes',
      flows: 'Fluxos',
      accessibility: 'Acessibilidade',
      interactions: 'Interações',
      effort: 'Esforço',
      automatable: 'Automatizável',
      question: 'Pergunta para PO',
    },
    'en': {
      header: '## 🎯 Requirements Analysis - Keelo',
      summary: 'Summary',
      complexity: 'Complexity',
      scope: 'Scope',
      scenarios: 'Test Scenarios',
      criteria: 'Acceptance Criteria',
      risks: 'Identified Risks',
      gaps: 'Requirements Gaps',
      suggestions: 'Suggestions',
      uiAnalysis: 'UI Analysis',
      components: 'Components',
      flows: 'Flows',
      accessibility: 'Accessibility',
      interactions: 'Interactions',
      effort: 'Effort',
      automatable: 'Automatable',
      question: 'Question for PO',
    },
  };
  
  const t = i18n[lang] || i18n['en'];
  
  // Header
  lines.push(t.header);
  lines.push('');
  
  // Summary
  lines.push(`### 📋 ${t.summary}`);
  lines.push('');
  lines.push(`**${result.summary.title}**`);
  lines.push('');
  lines.push(result.summary.description);
  lines.push('');
  lines.push(`> **${t.complexity}:** ${formatComplexity(result.summary.complexity)}`);
  if (result.summary.scope.length > 0) {
    lines.push(`> **${t.scope}:** ${result.summary.scope.join(', ')}`);
  }
  lines.push('');
  
  // Scenarios
  if (result.scenarios.length > 0) {
    lines.push(`### 🧪 ${t.scenarios} (${result.scenarios.length})`);
    lines.push('');
    
    for (const scenario of result.scenarios) {
      lines.push(`<details>`);
      lines.push(`<summary><b>${scenario.id}</b> - ${scenario.title} ${formatPriority(scenario.priority)}</summary>`);
      lines.push('');
      
      if (scenario.preconditions.length > 0) {
        lines.push('**Pré-condições:**');
        scenario.preconditions.forEach(p => lines.push(`- ${p}`));
        lines.push('');
      }
      
      lines.push('**Passos:**');
      scenario.steps.forEach((s, i) => lines.push(`${i + 1}. ${s}`));
      lines.push('');
      
      lines.push(`**Resultado Esperado:** ${scenario.expectedResult}`);
      lines.push('');
      
      lines.push(`> 📝 **Tipo:** ${scenario.suggestedTestType} | **${t.effort}:** ${formatComplexity(scenario.effort)}`);
      
      if (scenario.testData && scenario.testData.length > 0) {
        lines.push(`> 📊 **Dados:** ${scenario.testData.join(', ')}`);
      }
      
      lines.push('');
      lines.push('</details>');
      lines.push('');
    }
  }
  
  // Acceptance Criteria
  if (result.acceptanceCriteria.length > 0) {
    lines.push(`### ✅ ${t.criteria}`);
    lines.push('');
    
    for (const ac of result.acceptanceCriteria) {
      const autoIcon = ac.automatable ? '🤖' : '👤';
      lines.push(`**${ac.id}** ${autoIcon} ${ac.description}`);
      
      if (ac.gherkin) {
        lines.push('```gherkin');
        lines.push(`Given ${ac.gherkin.given}`);
        lines.push(`When ${ac.gherkin.when}`);
        lines.push(`Then ${ac.gherkin.then}`);
        lines.push('```');
      }
      lines.push('');
    }
  }
  
  // Gaps
  if (result.gaps.length > 0) {
    lines.push(`### ❓ ${t.gaps}`);
    lines.push('');
    
    const gapTypeIcons: Record<string, string> = {
      missing_info: '📋',
      ambiguity: '🔀',
      contradiction: '⚔️',
      edge_case: '🔲',
      dangerous_assumption: '⚠️',
      implicit_criterion: '📝',
      unclear_behavior: '❔',
    };
    
    const gapTypeLabels: Record<string, string> = {
      missing_info: 'Info Faltando',
      ambiguity: 'Ambiguidade',
      contradiction: 'Contradição',
      edge_case: 'Caso de Borda',
      dangerous_assumption: 'Hipótese Perigosa',
      implicit_criterion: 'Critério Implícito',
      unclear_behavior: 'Comportamento Não Claro',
    };
    
    for (const gap of result.gaps) {
      const icon = gapTypeIcons[gap.type] || '❓';
      const label = gapTypeLabels[gap.type] || gap.type;
      lines.push(`- ${formatPriority(gap.severity)} ${icon} **[${label}]** ${gap.title}`);
      lines.push(`  - ${gap.description}`);
      lines.push(`  - 💬 **${t.question}:** ${gap.question}`);
      if (gap.recommendation) {
        lines.push(`  - 💡 **Recomendação:** ${gap.recommendation}`);
      }
    }
    lines.push('');
  }
  
  // Risks
  if (result.risks.length > 0) {
    lines.push(`### ⚠️ ${t.risks}`);
    lines.push('');
    lines.push('| Risco | Severidade | Mitigação |');
    lines.push('|-------|------------|-----------|');
    
    for (const risk of result.risks) {
      lines.push(`| ${risk.title} | ${formatPriority(risk.severity)} | ${risk.mitigation} |`);
    }
    lines.push('');
  }
  
  // UI Analysis
  if (result.uiAnalysis) {
    lines.push(`### 🎨 ${t.uiAnalysis}`);
    lines.push('');
    
    if (result.uiAnalysis.components.length > 0) {
      lines.push(`#### ${t.components}`);
      lines.push('');
      lines.push('| Componente | Tipo | Estados |');
      lines.push('|------------|------|---------|');
      for (const comp of result.uiAnalysis.components) {
        lines.push(`| ${comp.name} | ${comp.type} | ${comp.states.join(', ')} |`);
      }
      lines.push('');
    }
    
    if (result.uiAnalysis.accessibilityIssues.length > 0) {
      lines.push(`#### ♿ ${t.accessibility}`);
      lines.push('');
      for (const issue of result.uiAnalysis.accessibilityIssues) {
        lines.push(`- **${issue.element}** (WCAG ${issue.wcagLevel}): ${issue.issue}`);
        lines.push(`  - 💡 ${issue.suggestion}`);
      }
      lines.push('');
    }
  }
  
  // Suggestions
  if (result.suggestions.length > 0) {
    lines.push(`### 💡 ${t.suggestions}`);
    lines.push('');
    for (const suggestion of result.suggestions) {
      lines.push(`- ${suggestion}`);
    }
    lines.push('');
  }
  
  // Footer
  lines.push('---');
  lines.push(`*Gerado por Keelo - Análise Pré-Implementação | v${result.version}*`);
  
  return lines.join('\n');
}

function formatComplexity(complexity: string): string {
  const map: Record<string, string> = {
    low: '🟢 Baixa',
    medium: '🟡 Média',
    high: '🔴 Alta',
  };
  return map[complexity] || complexity;
}

function formatPriority(level: RiskLevel): string {
  const map: Record<RiskLevel, string> = {
    critical: '🔴',
    high: '🟠',
    medium: '🟡',
    low: '🟢',
  };
  return map[level] || '🟡';
}

// =============================================================================
// Implementation Prompt Generation
// =============================================================================

/**
 * Generates a detailed prompt for implementing the test scenarios
 * This prompt can be used by an AI assistant to create the actual tests
 */
function generateImplementationPrompt(
  result: RequirementsAnalysisResult,
  input: RequirementsInput
): string {
  const lang = keeloConfig.language === 'pt-br' ? 'pt-br' : 'en';
  
  const lines: string[] = [];
  
  if (lang === 'pt-br') {
    lines.push('# 🎯 Prompt para Implementação de Testes');
    lines.push('');
    lines.push('## Contexto');
    lines.push('');
    lines.push(`A análise de requisitos identificou **${result.scenarios.length} cenários de teste**, `);
    lines.push(`**${result.risks.length} riscos** e **${result.gaps.length} gaps funcionais** que precisam ser endereçados.`);
    lines.push('');
    
    if (input.metadata?.featureName) {
      lines.push(`**Feature:** ${input.metadata.featureName}`);
    }
    if (input.metadata?.projectName) {
      lines.push(`**Projeto:** ${input.metadata.projectName}`);
    }
    lines.push('');
    
    // Scenarios to implement
    lines.push('## 📋 Cenários a Implementar');
    lines.push('');
    
    const criticalScenarios = result.scenarios.filter(s => s.priority === 'critical' || s.priority === 'high');
    const otherScenarios = result.scenarios.filter(s => s.priority !== 'critical' && s.priority !== 'high');
    
    if (criticalScenarios.length > 0) {
      lines.push('### 🔴 Alta Prioridade (Críticos)');
      lines.push('');
      for (const scenario of criticalScenarios) {
        lines.push(`#### ${scenario.id}: ${scenario.title}`);
        lines.push('');
        lines.push(`- **Categoria:** ${scenario.category}`);
        lines.push(`- **Tipo de Teste:** ${scenario.suggestedTestType}`);
        lines.push(`- **Esforço:** ${scenario.effort}`);
        lines.push('');
        if (scenario.preconditions && scenario.preconditions.length > 0) {
          lines.push('**Pré-condições:**');
          for (const pre of scenario.preconditions) {
            lines.push(`- ${pre}`);
          }
          lines.push('');
        }
        lines.push('**Passos:**');
        for (let i = 0; i < scenario.steps.length; i++) {
          lines.push(`${i + 1}. ${scenario.steps[i]}`);
        }
        lines.push('');
        lines.push(`**Resultado Esperado:** ${scenario.expectedResult}`);
        lines.push('');
        if (scenario.testData && scenario.testData.length > 0) {
          lines.push('**Dados de Teste:**');
          for (const data of scenario.testData) {
            lines.push(`- ${data}`);
          }
          lines.push('');
        }
        lines.push('---');
        lines.push('');
      }
    }
    
    if (otherScenarios.length > 0) {
      lines.push('### 🟡 Prioridade Normal');
      lines.push('');
      for (const scenario of otherScenarios) {
        lines.push(`- **${scenario.id}:** ${scenario.title} (${scenario.suggestedTestType}, ${scenario.effort})`);
      }
      lines.push('');
    }
    
    // Risks to mitigate
    if (result.risks.length > 0) {
      lines.push('## ⚠️ Riscos a Mitigar');
      lines.push('');
      lines.push('Os seguintes riscos foram identificados e os testes devem cobri-los:');
      lines.push('');
      for (const risk of result.risks) {
        lines.push(`### ${risk.severity === 'critical' ? '🔴' : risk.severity === 'high' ? '🟠' : '🟡'} ${risk.title}`);
        lines.push('');
        lines.push(risk.description);
        lines.push('');
        if (risk.mitigation) {
          lines.push(`**Mitigação:** ${risk.mitigation}`);
          lines.push('');
        }
        if (risk.affectedAreas && risk.affectedAreas.length > 0) {
          lines.push(`**Áreas Afetadas:** ${risk.affectedAreas.join(', ')}`);
          lines.push('');
        }
      }
    }
    
    // Acceptance Criteria
    if (result.acceptanceCriteria.length > 0) {
      lines.push('## ✅ Critérios de Aceite (Gherkin)');
      lines.push('');
      lines.push('Use estes critérios como base para os testes:');
      lines.push('');
      for (const ac of result.acceptanceCriteria) {
        lines.push(`### ${ac.id}: ${ac.description}`);
        lines.push('');
        if (ac.gherkin) {
          lines.push('```gherkin');
          lines.push(`Given ${ac.gherkin.given}`);
          lines.push(`When ${ac.gherkin.when}`);
          lines.push(`Then ${ac.gherkin.then}`);
          lines.push('```');
          lines.push('');
        }
        if (ac.automatable) {
          lines.push('✅ Automatizável');
        }
        lines.push('');
      }
    }
    
    // Implementation instructions
    lines.push('## 🛠️ Instruções de Implementação');
    lines.push('');
    lines.push('1. **Priorize os cenários críticos** - Comece pelos cenários de alta prioridade');
    lines.push('2. **Mitigue os riscos** - Cada risco identificado deve ter pelo menos um teste cobrindo-o');
    lines.push('3. **Use os critérios de aceite** - Os Gherkins fornecidos devem guiar a estrutura dos testes');
    lines.push('4. **Considere os dados de teste** - Use os dados sugeridos ou crie variações');
    lines.push('5. **Documente dependências** - Se um teste depende de outro, indique claramente');
    lines.push('');
    
    // Framework recommendation
    lines.push('## 🔧 Framework Recomendado');
    lines.push('');
    const e2eCount = result.scenarios.filter(s => s.suggestedTestType === 'e2e').length;
    const unitCount = result.scenarios.filter(s => s.suggestedTestType === 'unit').length;
    const integrationCount = result.scenarios.filter(s => s.suggestedTestType === 'integration').length;
    
    if (e2eCount > 0) {
      lines.push(`- **E2E (${e2eCount}):** Playwright ou Cypress`);
    }
    if (unitCount > 0) {
      lines.push(`- **Unitários (${unitCount}):** Jest ou Vitest`);
    }
    if (integrationCount > 0) {
      lines.push(`- **Integração (${integrationCount}):** Supertest ou Pactum`);
    }
    lines.push('');
    
  } else {
    // English version
    lines.push('# 🎯 Test Implementation Prompt');
    lines.push('');
    lines.push('## Context');
    lines.push('');
    lines.push(`The requirements analysis identified **${result.scenarios.length} test scenarios**, `);
    lines.push(`**${result.risks.length} risks** and **${result.gaps.length} functional gaps** that need to be addressed.`);
    lines.push('');
    
    // Add similar content in English...
    lines.push('## 📋 Scenarios to Implement');
    lines.push('');
    for (const scenario of result.scenarios) {
      lines.push(`- **${scenario.id}:** ${scenario.title} (${scenario.suggestedTestType}, ${scenario.priority})`);
    }
    lines.push('');
    
    if (result.risks.length > 0) {
      lines.push('## ⚠️ Risks to Mitigate');
      lines.push('');
      for (const risk of result.risks) {
        lines.push(`- **${risk.title}:** ${risk.description}`);
      }
      lines.push('');
    }
  }
  
  lines.push('---');
  lines.push('*Este prompt foi gerado automaticamente pelo Keelo para auxiliar na implementação dos testes.*');
  
  return lines.join('\n');
}

/**
 * Exports the implementation prompt for external use
 */
export function getImplementationPrompt(result: RequirementsAnalysisResult): string {
  return result.implementationPrompt || '';
}

