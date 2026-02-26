import { writeFileSync, mkdirSync, existsSync, readFileSync } from 'fs';
import { join, dirname } from 'path';
import { keeloConfig, logger } from '../config/index.js';
import { callLLM } from './llm.js';
import { 
  detectTestPattern, 
  formatPatternSummary,
  DEFAULT_POM_STRUCTURE,
  type TestPattern,
  type TestStructure,
} from '../integrations/github/index.js';
import { validateTestBatch, type ValidationResult } from './test-validator.js';
import type { AnalysisResult, TestScenario, PullRequestContext } from './types.js';

// =============================================================================
// Types
// =============================================================================

export interface GeneratedTest {
  id: string;
  filename: string;
  framework: string;
  type: 'unit' | 'integration' | 'e2e' | 'api' | 'page' | 'util';
  code: string;
  dependencies: string[];
  validation?: ValidationResult;
}

export interface TestGenerationResult {
  tests: GeneratedTest[];
  pattern: TestPattern;
  setupCode?: string;
  configUpdates?: Record<string, string>;
  validation: {
    totalTests: number;
    validTests: number;
    invalidTests: number;
  };
}

interface POMGenerationResult {
  files: {
    path: string;
    type: 'page' | 'test' | 'util';
    content: string;
  }[];
  dependencies: string[];
}

// =============================================================================
// Prompt Loading
// =============================================================================

function loadPOMPrompt(): string {
  const lang = keeloConfig.language;
  const promptsDir = join(process.cwd(), 'prompts');
  
  const promptPath = join(promptsDir, `test-pom.${lang}.md`);
  const fallbackPath = join(promptsDir, 'test-pom.en.md');
  
  if (existsSync(promptPath)) {
    return readFileSync(promptPath, 'utf-8');
  }
  if (existsSync(fallbackPath)) {
    return readFileSync(fallbackPath, 'utf-8');
  }
  
  return '';
}

// =============================================================================
// Test Generation
// =============================================================================

export async function generateTests(
  analysis: AnalysisResult,
  context: PullRequestContext
): Promise<TestGenerationResult> {
  logger.info({ 
    scenarioCount: analysis.scenarios.length,
  }, 'Starting test generation');

  // Step 1: Detect existing test patterns
  const pattern = await detectTestPattern(context);
  logger.info({ 
    detected: pattern.detected,
    framework: pattern.framework,
    structureType: pattern.structure.type 
  }, 'Pattern detection completed');

  // Step 2: Generate tests based on pattern
  let tests: GeneratedTest[] = [];

  // Use POM pattern for e2e tests
  if (pattern.structure.type === 'pom' || !pattern.detected) {
    tests = await generatePOMTests(analysis, context, pattern);
  } else {
    // Use detected flat structure
    tests = await generateFlatTests(analysis, context, pattern);
  }

  // Step 3: Validate generated tests
  logger.info({ testCount: tests.length }, 'Validating generated tests...');
  
  const validationResult = validateTestBatch(
    tests.map(t => ({ filename: t.filename, code: t.code }))
  );

  // Attach validation results to each test
  for (const test of tests) {
    test.validation = validationResult.results.get(test.filename);
  }

  // Filter out invalid tests (keep only syntactically valid ones)
  const validTests = tests.filter(t => t.validation?.valid !== false);
  const invalidTests = tests.filter(t => t.validation?.valid === false);

  if (invalidTests.length > 0) {
    logger.warn({
      invalidCount: invalidTests.length,
      invalidFiles: invalidTests.map(t => t.filename),
    }, 'Some generated tests failed validation and will be excluded');
  }

  const result: TestGenerationResult = {
    tests: validTests,
    pattern,
    validation: {
      totalTests: tests.length,
      validTests: validTests.length,
      invalidTests: invalidTests.length,
    },
  };

  logger.info({ 
    testCount: result.tests.length,
    validationStats: result.validation,
  }, 'Tests generated and validated successfully');
  
  return result;
}

// =============================================================================
// POM Test Generation
// =============================================================================

async function generatePOMTests(
  analysis: AnalysisResult,
  context: PullRequestContext,
  pattern: TestPattern
): Promise<GeneratedTest[]> {
  const pomPrompt = loadPOMPrompt();
  if (!pomPrompt) {
    logger.warn('POM prompt not found, falling back to basic generation');
    return generateFlatTests(analysis, context, pattern);
  }

  const structure = pattern.detected ? pattern.structure : DEFAULT_POM_STRUCTURE;
  const userPrompt = buildPOMPrompt(analysis, context, pattern, structure);

  const content = await callLLM({
    systemPrompt: pomPrompt,
    userPrompt,
    jsonMode: true,
  });
  
  try {
    const parsed = JSON.parse(content) as POMGenerationResult;
    
    return (parsed.files || []).map((file, index) => ({
      id: `POM${String(index + 1).padStart(3, '0')}`,
      filename: file.path,
      framework: pattern.framework !== 'unknown' ? pattern.framework : 'playwright',
      type: file.type as GeneratedTest['type'],
      code: file.content,
      dependencies: parsed.dependencies || ['@playwright/test'],
    }));
  } catch (error) {
    logger.error({ error }, 'Failed to parse POM generation response');
    return [];
  }
}

function buildPOMPrompt(
  analysis: AnalysisResult,
  context: PullRequestContext,
  pattern: TestPattern,
  structure: TestStructure
): string {
  const scenarios = analysis.scenarios
    .filter(s => s.testType === 'e2e' || s.priority === 'critical' || s.priority === 'high')
    .slice(0, 8);

  let prompt = `
## Test Generation Request

### PR Context
- **Title:** ${context.title}
- **Repository:** ${context.owner}/${context.repo}
- **Description:** ${context.body || 'No description'}

### Test Structure
- **Pattern:** ${pattern.detected ? 'Existing pattern detected' : 'No existing tests - use POM'}
- **Framework:** ${pattern.framework !== 'unknown' ? pattern.framework : 'playwright'}
- **Tests Directory:** ${structure.testsDir}
- **Pages Directory:** ${structure.pagesDir || 'e2e/pages'}
- **Utils Directory:** ${structure.utilsDir || 'e2e/utils'}

### Test Scenarios to Implement

${scenarios.map(s => formatScenarioForPrompt(s)).join('\n\n')}
`;

  // Add examples if available
  if (pattern.examples.length > 0) {
    prompt += `\n### Existing Code Examples (follow this style)\n\n`;
    
    for (const example of pattern.examples) {
      prompt += `#### ${example.type}: ${example.path}\n\`\`\`typescript\n${example.content}\n\`\`\`\n\n`;
    }
  }

  prompt += `\n### Code Diff (for context)\n\`\`\`diff\n${context.diff.substring(0, 5000)}\n\`\`\`\n`;

  prompt += `\nGenerate POM test files following the structure above. Include Page Objects for any pages involved in the scenarios.`;

  return prompt;
}

// =============================================================================
// Flat Test Generation (fallback)
// =============================================================================

async function generateFlatTests(
  analysis: AnalysisResult,
  context: PullRequestContext,
  pattern: TestPattern
): Promise<GeneratedTest[]> {
  const userPrompt = buildFlatTestPrompt(analysis, context, pattern);

  const content = await callLLM({
    systemPrompt: getFlatTestSystemPrompt(),
    userPrompt,
    jsonMode: true,
  });
  
  try {
    const parsed = JSON.parse(content) as { tests: GeneratedTest[] };
    return parsed.tests || [];
  } catch (error) {
    logger.error({ error }, 'Failed to parse flat test generation response');
    return [];
  }
}

function buildFlatTestPrompt(
  analysis: AnalysisResult,
  context: PullRequestContext,
  pattern: TestPattern
): string {
  const scenarios = analysis.scenarios
    .filter(s => s.priority === 'critical' || s.priority === 'high')
    .slice(0, 10);

  return `
## Test Generation Request

### PR Context
- **Title:** ${context.title}
- **Repository:** ${context.owner}/${context.repo}

### Configured Frameworks
- **E2E:** ${keeloConfig.testFrameworks.e2e}
- **Unit:** ${keeloConfig.testFrameworks.unit}
- **API:** ${keeloConfig.testFrameworks.api}

### Test Directory
${pattern.structure.testsDir}

### Test Scenarios to Implement

${scenarios.map(s => formatScenarioForPrompt(s)).join('\n\n')}

### Code Diff (for context)
\`\`\`diff
${context.diff.substring(0, 5000)}
\`\`\`

Generate test files for the scenarios above.
`;
}

function getFlatTestSystemPrompt(): string {
  return `You are a test code generator. Generate test code in JSON format:

{
  "tests": [
    {
      "id": "TC001",
      "filename": "feature.spec.ts",
      "framework": "playwright",
      "type": "e2e",
      "code": "// test code",
      "dependencies": ["@playwright/test"]
    }
  ]
}

Write complete, runnable test files. Use TypeScript. Follow best practices.`;
}

// =============================================================================
// Helpers
// =============================================================================

function formatScenarioForPrompt(scenario: TestScenario): string {
  return `
#### ${scenario.id}: ${scenario.title}
- **Category:** ${scenario.category}
- **Priority:** ${scenario.priority}
- **Test Type:** ${scenario.testType}
- **Preconditions:** ${scenario.preconditions.join(', ') || 'None'}
- **Steps:**
${scenario.steps.map((s, i) => `  ${i + 1}. ${s}`).join('\n')}
- **Expected Result:** ${scenario.expectedResult}
`;
}

// =============================================================================
// File Writing
// =============================================================================

export async function writeTestFiles(
  result: TestGenerationResult,
  baseDir: string = process.cwd()
): Promise<string[]> {
  const writtenFiles: string[] = [];

  for (const test of result.tests) {
    const filePath = join(baseDir, test.filename);
    const fileDir = dirname(filePath);

    // Ensure directory exists
    if (!existsSync(fileDir)) {
      mkdirSync(fileDir, { recursive: true });
    }

    writeFileSync(filePath, test.code, 'utf-8');
    writtenFiles.push(filePath);
    
    logger.info({ file: filePath, type: test.type }, 'Test file written');
  }

  return writtenFiles;
}

// =============================================================================
// Summary Generation
// =============================================================================

export function formatTestSummary(result: TestGenerationResult): string {
  const lines: string[] = ['### 🧪 Generated Tests', ''];

  // Pattern info
  lines.push(formatPatternSummary(result.pattern));
  lines.push('');

  // Validation summary
  if (result.validation) {
    const { totalTests, validTests, invalidTests } = result.validation;
    if (invalidTests > 0) {
      lines.push(`> ⚠️ **Validation:** ${validTests}/${totalTests} tests passed syntax validation (${invalidTests} excluded)`);
    } else if (totalTests > 0) {
      lines.push(`> ✅ **Validation:** All ${validTests} tests passed syntax validation`);
    }
    lines.push('');
  }

  if (result.tests.length === 0) {
    lines.push('No tests were generated.');
    return lines.join('\n');
  }

  // Group by type
  const byType: Record<string, GeneratedTest[]> = {};
  for (const test of result.tests) {
    byType[test.type] = byType[test.type] || [];
    byType[test.type].push(test);
  }

  lines.push('| File | Type | Framework | Status |');
  lines.push('|------|------|-----------|--------|');
  for (const test of result.tests) {
    const hasWarnings = (test.validation?.warnings?.length || 0) > 0;
    const status = hasWarnings ? '⚠️' : '✅';
    lines.push(`| \`${test.filename}\` | ${test.type} | ${test.framework} | ${status} |`);
  }
  lines.push('');

  // Show validation warnings if any
  const testsWithWarnings = result.tests.filter(t => (t.validation?.warnings?.length || 0) > 0);
  if (testsWithWarnings.length > 0) {
    lines.push('<details>');
    lines.push('<summary>⚠️ Validation Warnings</summary>');
    lines.push('');
    for (const test of testsWithWarnings) {
      lines.push(`**${test.filename}:**`);
      for (const warning of test.validation?.warnings || []) {
        lines.push(`- ${warning.message}`);
        if (warning.suggestion) {
          lines.push(`  - 💡 ${warning.suggestion}`);
        }
      }
      lines.push('');
    }
    lines.push('</details>');
    lines.push('');
  }

  // Dependencies
  const allDeps = [...new Set(result.tests.flatMap(t => t.dependencies))];
  if (allDeps.length > 0) {
    lines.push('**Dependencies:**');
    lines.push('```bash');
    lines.push(`npm install -D ${allDeps.join(' ')}`);
    lines.push('```');
  }

  return lines.join('\n');
}
