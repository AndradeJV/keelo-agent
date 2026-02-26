import { logger, keeloConfig } from '../config/index.js';
import { createOctokitForInstallation } from '../integrations/github/client.js';
import type { PullRequestContext } from './types.js';

// =============================================================================
// Constants
// =============================================================================

const MIN_COVERAGE_THRESHOLD = keeloConfig.coverage?.minThreshold ?? 80;
const CRITICAL_PATHS = [
  'auth', 'authentication', 'login', 'password', 'token', 'jwt', 'oauth',
  'payment', 'checkout', 'billing', 'transaction', 'stripe', 'paypal',
  'security', 'encryption', 'crypto', 'hash',
  'database', 'migration', 'schema',
  'api', 'middleware', 'controller',
];

// =============================================================================
// Types
// =============================================================================

export interface CoverageReport {
  overall: CoverageMetrics;
  files: FileCoverage[];
  uncoveredAreas: UncoveredArea[];
}

export interface CoverageMetrics {
  lines: { covered: number; total: number; percentage: number };
  branches: { covered: number; total: number; percentage: number };
  functions: { covered: number; total: number; percentage: number };
  statements: { covered: number; total: number; percentage: number };
}

export interface FileCoverage {
  path: string;
  metrics: CoverageMetrics;
  uncoveredLines: number[];
  uncoveredBranches: number[];
}

export interface UncoveredArea {
  file: string;
  startLine: number;
  endLine: number;
  type: 'function' | 'branch' | 'block';
  name?: string;
  suggestedTest?: string;
}

export interface CoverageAnalysisResult {
  found: boolean;
  report?: CoverageReport;
  suggestions: CoverageSuggestion[];
  impactedFiles: string[];
  heuristicAnalysis?: HeuristicAnalysis;
}

export interface CoverageSuggestion {
  priority: 'high' | 'medium' | 'low';
  file: string;
  area: string;
  reason: string;
  testType: 'unit' | 'integration' | 'e2e';
}

// =============================================================================
// Coverage File Detection
// =============================================================================

const COVERAGE_PATHS = [
  'coverage/lcov.info',
  'coverage/coverage-final.json',
  'coverage/coverage-summary.json',
  '.nyc_output/coverage.json',
  'coverage/clover.xml',
  'coverage-report/lcov.info',
];

export async function detectCoverageReport(
  context: PullRequestContext
): Promise<{ found: boolean; path?: string; type?: 'lcov' | 'istanbul' | 'clover' }> {
  const octokit = createOctokitForInstallation(context.installationId);

  for (const coveragePath of COVERAGE_PATHS) {
    try {
      await octokit.repos.getContent({
        owner: context.owner,
        repo: context.repo,
        path: coveragePath,
      });

      const type = coveragePath.includes('lcov') ? 'lcov' 
        : coveragePath.includes('clover') ? 'clover' 
        : 'istanbul';

      logger.info({ path: coveragePath, type }, 'Coverage report found');
      return { found: true, path: coveragePath, type };
    } catch {
      // File doesn't exist, continue
    }
  }

  logger.info('No coverage report found in repository');
  return { found: false };
}

// =============================================================================
// Coverage Parsing
// =============================================================================

export async function parseCoverageReport(
  context: PullRequestContext,
  coveragePath: string,
  type: 'lcov' | 'istanbul' | 'clover'
): Promise<CoverageReport | null> {
  const octokit = createOctokitForInstallation(context.installationId);

  try {
    const response = await octokit.repos.getContent({
      owner: context.owner,
      repo: context.repo,
      path: coveragePath,
    });

    if (!('content' in response.data)) {
      return null;
    }

    const content = Buffer.from(response.data.content, 'base64').toString('utf-8');

    switch (type) {
      case 'lcov':
        return parseLcov(content);
      case 'istanbul':
        return parseIstanbul(content);
      case 'clover':
        return parseClover(content);
      default:
        return null;
    }
  } catch (error) {
    logger.error({ error, path: coveragePath }, 'Failed to parse coverage report');
    return null;
  }
}

function parseLcov(content: string): CoverageReport {
  const files: FileCoverage[] = [];
  const sections = content.split('end_of_record').filter(s => s.trim());

  for (const section of sections) {
    const lines = section.split('\n').filter(l => l.trim());
    const sfLine = lines.find(l => l.startsWith('SF:'));
    if (!sfLine) continue;

    const filePath = sfLine.substring(3);
    const linesFound = parseInt(lines.find(l => l.startsWith('LF:'))?.substring(3) || '0');
    const linesHit = parseInt(lines.find(l => l.startsWith('LH:'))?.substring(3) || '0');
    const branchesFound = parseInt(lines.find(l => l.startsWith('BRF:'))?.substring(4) || '0');
    const branchesHit = parseInt(lines.find(l => l.startsWith('BRH:'))?.substring(4) || '0');
    const functionsFound = parseInt(lines.find(l => l.startsWith('FNF:'))?.substring(4) || '0');
    const functionsHit = parseInt(lines.find(l => l.startsWith('FNH:'))?.substring(4) || '0');

    // Find uncovered lines
    const uncoveredLines: number[] = [];
    for (const line of lines) {
      if (line.startsWith('DA:')) {
        const [lineNum, hits] = line.substring(3).split(',').map(Number);
        if (hits === 0) {
          uncoveredLines.push(lineNum);
        }
      }
    }

    // Find uncovered branches
    const uncoveredBranches: number[] = [];
    for (const line of lines) {
      if (line.startsWith('BRDA:')) {
        const parts = line.substring(5).split(',');
        if (parts[3] === '0' || parts[3] === '-') {
          uncoveredBranches.push(parseInt(parts[0]));
        }
      }
    }

    files.push({
      path: filePath,
      metrics: {
        lines: { covered: linesHit, total: linesFound, percentage: linesFound ? (linesHit / linesFound) * 100 : 0 },
        branches: { covered: branchesHit, total: branchesFound, percentage: branchesFound ? (branchesHit / branchesFound) * 100 : 0 },
        functions: { covered: functionsHit, total: functionsFound, percentage: functionsFound ? (functionsHit / functionsFound) * 100 : 0 },
        statements: { covered: linesHit, total: linesFound, percentage: linesFound ? (linesHit / linesFound) * 100 : 0 },
      },
      uncoveredLines,
      uncoveredBranches,
    });
  }

  return buildCoverageReport(files);
}

function parseIstanbul(content: string): CoverageReport {
  try {
    const data = JSON.parse(content);
    const files: FileCoverage[] = [];

    for (const [filePath, fileData] of Object.entries(data)) {
      const fd = fileData as Record<string, unknown>;
      const s = fd.s as Record<string, number> || {};
      const b = fd.b as Record<string, number[]> || {};
      const f = fd.f as Record<string, number> || {};

      const statements = Object.values(s);
      const branches = Object.values(b).flat();
      const functions = Object.values(f);

      const uncoveredLines: number[] = [];
      const statementMap = fd.statementMap as Record<string, { start: { line: number } }> || {};
      for (const [key, hits] of Object.entries(s)) {
        if (hits === 0 && statementMap[key]) {
          uncoveredLines.push(statementMap[key].start.line);
        }
      }

      files.push({
        path: filePath,
        metrics: {
          lines: { 
            covered: statements.filter(h => h > 0).length, 
            total: statements.length, 
            percentage: statements.length ? (statements.filter(h => h > 0).length / statements.length) * 100 : 0 
          },
          branches: { 
            covered: branches.filter(h => h > 0).length, 
            total: branches.length, 
            percentage: branches.length ? (branches.filter(h => h > 0).length / branches.length) * 100 : 0 
          },
          functions: { 
            covered: functions.filter(h => h > 0).length, 
            total: functions.length, 
            percentage: functions.length ? (functions.filter(h => h > 0).length / functions.length) * 100 : 0 
          },
          statements: { 
            covered: statements.filter(h => h > 0).length, 
            total: statements.length, 
            percentage: statements.length ? (statements.filter(h => h > 0).length / statements.length) * 100 : 0 
          },
        },
        uncoveredLines,
        uncoveredBranches: [],
      });
    }

    return buildCoverageReport(files);
  } catch {
    return { overall: emptyMetrics(), files: [], uncoveredAreas: [] };
  }
}

function parseClover(_content: string): CoverageReport {
  // Simplified clover parsing - would need XML parser for full implementation
  logger.warn('Clover format not fully implemented, returning empty report');
  return { overall: emptyMetrics(), files: [], uncoveredAreas: [] };
}

function buildCoverageReport(files: FileCoverage[]): CoverageReport {
  const overall: CoverageMetrics = {
    lines: { covered: 0, total: 0, percentage: 0 },
    branches: { covered: 0, total: 0, percentage: 0 },
    functions: { covered: 0, total: 0, percentage: 0 },
    statements: { covered: 0, total: 0, percentage: 0 },
  };

  for (const file of files) {
    overall.lines.covered += file.metrics.lines.covered;
    overall.lines.total += file.metrics.lines.total;
    overall.branches.covered += file.metrics.branches.covered;
    overall.branches.total += file.metrics.branches.total;
    overall.functions.covered += file.metrics.functions.covered;
    overall.functions.total += file.metrics.functions.total;
    overall.statements.covered += file.metrics.statements.covered;
    overall.statements.total += file.metrics.statements.total;
  }

  overall.lines.percentage = overall.lines.total ? (overall.lines.covered / overall.lines.total) * 100 : 0;
  overall.branches.percentage = overall.branches.total ? (overall.branches.covered / overall.branches.total) * 100 : 0;
  overall.functions.percentage = overall.functions.total ? (overall.functions.covered / overall.functions.total) * 100 : 0;
  overall.statements.percentage = overall.statements.total ? (overall.statements.covered / overall.statements.total) * 100 : 0;

  // Identify uncovered areas
  const uncoveredAreas: UncoveredArea[] = [];
  for (const file of files) {
    if (file.uncoveredLines.length > 0) {
      // Group consecutive lines
      const groups = groupConsecutiveNumbers(file.uncoveredLines);
      for (const group of groups) {
        uncoveredAreas.push({
          file: file.path,
          startLine: group[0],
          endLine: group[group.length - 1],
          type: 'block',
        });
      }
    }
  }

  return { overall, files, uncoveredAreas };
}

function emptyMetrics(): CoverageMetrics {
  return {
    lines: { covered: 0, total: 0, percentage: 0 },
    branches: { covered: 0, total: 0, percentage: 0 },
    functions: { covered: 0, total: 0, percentage: 0 },
    statements: { covered: 0, total: 0, percentage: 0 },
  };
}

function groupConsecutiveNumbers(numbers: number[]): number[][] {
  if (numbers.length === 0) return [];
  
  const sorted = [...numbers].sort((a, b) => a - b);
  const groups: number[][] = [[sorted[0]]];
  
  for (let i = 1; i < sorted.length; i++) {
    const currentGroup = groups[groups.length - 1];
    if (sorted[i] - currentGroup[currentGroup.length - 1] === 1) {
      currentGroup.push(sorted[i]);
    } else {
      groups.push([sorted[i]]);
    }
  }
  
  return groups;
}

// =============================================================================
// Coverage Analysis
// =============================================================================

export async function analyzeCoverage(
  context: PullRequestContext,
  changedFiles: string[]
): Promise<CoverageAnalysisResult> {
  // Step 1: Try to find real coverage report
  const detection = await detectCoverageReport(context);
  
  if (detection.found && detection.path && detection.type) {
    const report = await parseCoverageReport(context, detection.path, detection.type);
    
    if (report && report.files.length > 0) {
      // Find impacted files from PR that have coverage data
      const impactedFiles = changedFiles.filter(cf => 
        report.files.some(f => f.path.includes(cf) || cf.includes(f.path))
      );

      // Generate suggestions for uncovered areas
      const suggestions = generateCoverageSuggestions(report, impactedFiles, changedFiles);

      logger.info({
        source: 'real',
        overallCoverage: report.overall.lines.percentage.toFixed(1) + '%',
        filesWithCoverage: report.files.length,
        impactedFiles: impactedFiles.length,
        suggestions: suggestions.length,
      }, 'Coverage analysis completed (real data)');

      return {
        found: true,
        report,
        suggestions,
        impactedFiles,
      };
    }
  }

  // Step 2: Try CI artifacts (GitHub Actions)
  const ciCoverage = await fetchCoverageFromCI(context);
  if (ciCoverage) {
    const impactedFiles = changedFiles.filter(cf => 
      ciCoverage.files.some(f => f.path.includes(cf) || cf.includes(f.path))
    );
    const suggestions = generateCoverageSuggestions(ciCoverage, impactedFiles, changedFiles);

    logger.info({
      source: 'ci-artifact',
      overallCoverage: ciCoverage.overall.lines.percentage.toFixed(1) + '%',
    }, 'Coverage analysis completed (CI artifact)');

    return {
      found: true,
      report: ciCoverage,
      suggestions,
      impactedFiles,
    };
  }

  // Step 3: Fallback to heuristic analysis
  logger.info({ changedFiles: changedFiles.length }, 'No coverage found, using heuristic analysis');
  const heuristicResult = generateHeuristicCoverageSuggestions(changedFiles, context.diff);

  return {
    found: false,
    suggestions: heuristicResult.suggestions,
    impactedFiles: changedFiles,
    heuristicAnalysis: heuristicResult,
  };
}

// =============================================================================
// CI Artifact Fetching
// =============================================================================

async function fetchCoverageFromCI(context: PullRequestContext): Promise<CoverageReport | null> {
  try {
    const octokit = createOctokitForInstallation(context.installationId);
    
    // Get recent workflow runs
    const runs = await octokit.actions.listWorkflowRunsForRepo({
      owner: context.owner,
      repo: context.repo,
      per_page: 5,
      status: 'completed',
    });

    for (const run of runs.data.workflow_runs) {
      // Get artifacts from the run
      const artifacts = await octokit.actions.listWorkflowRunArtifacts({
        owner: context.owner,
        repo: context.repo,
        run_id: run.id,
      });

      // Look for coverage artifact
      const coverageArtifact = artifacts.data.artifacts.find(a => 
        a.name.toLowerCase().includes('coverage') ||
        a.name.toLowerCase().includes('lcov')
      );

      if (coverageArtifact) {
        logger.info({ 
          artifactId: coverageArtifact.id, 
          name: coverageArtifact.name 
        }, 'Found coverage artifact in CI');
        
        // Note: Downloading artifact requires additional permissions
        // For now, just log that we found it
        // In production, you would download and parse the artifact
        return null;
      }
    }
  } catch (error) {
    logger.debug({ error }, 'Could not fetch CI artifacts (may not have permission)');
  }

  return null;
}

// =============================================================================
// Heuristic Analysis (when no real coverage available)
// =============================================================================

export interface HeuristicAnalysis {
  estimatedRisk: 'high' | 'medium' | 'low';
  criticalPathsImpacted: string[];
  testFilesFound: number;
  suggestions: CoverageSuggestion[];
  reasoning: string[];
}

function generateHeuristicCoverageSuggestions(
  changedFiles: string[],
  diff: string
): HeuristicAnalysis {
  const suggestions: CoverageSuggestion[] = [];
  const reasoning: string[] = [];
  const criticalPathsImpacted: string[] = [];

  // Analyze changed files
  const sourceFiles = changedFiles.filter(f => 
    /\.(ts|tsx|js|jsx|py|go|java|rb)$/.test(f) && 
    !f.includes('.test.') && 
    !f.includes('.spec.') &&
    !f.includes('__tests__')
  );

  const testFiles = changedFiles.filter(f => 
    f.includes('.test.') || 
    f.includes('.spec.') || 
    f.includes('__tests__')
  );

  // Check for critical paths
  for (const file of sourceFiles) {
    const lowerPath = file.toLowerCase();
    for (const criticalPath of CRITICAL_PATHS) {
      if (lowerPath.includes(criticalPath)) {
        criticalPathsImpacted.push(file);
        suggestions.push({
          priority: 'high',
          file,
          area: `Caminho crítico: ${criticalPath}`,
          reason: `Arquivo em área sensível (${criticalPath}) - requer cobertura de teste`,
          testType: 'unit',
        });
        break;
      }
    }
  }

  // Check for new files without corresponding test
  for (const sourceFile of sourceFiles) {
    const baseName = sourceFile.replace(/\.(ts|tsx|js|jsx|py|go|java|rb)$/, '');
    const hasTest = testFiles.some(t => 
      t.includes(baseName) || 
      t.replace(/\.test|\.spec/, '').includes(baseName.split('/').pop() || '')
    );

    if (!hasTest && !criticalPathsImpacted.includes(sourceFile)) {
      suggestions.push({
        priority: 'medium',
        file: sourceFile,
        area: 'Arquivo sem teste correspondente',
        reason: 'Nenhum arquivo de teste encontrado para este arquivo',
        testType: 'unit',
      });
    }
  }

  // Analyze diff for complexity indicators
  const complexityIndicators = {
    conditionals: (diff.match(/if\s*\(|switch\s*\(|\?\s*:/g) || []).length,
    loops: (diff.match(/for\s*\(|while\s*\(|\.forEach|\.map\(|\.filter\(/g) || []).length,
    errorHandling: (diff.match(/try\s*\{|catch\s*\(|\.catch\(|throw\s+/g) || []).length,
    asyncOperations: (diff.match(/async\s+|await\s+|\.then\(|Promise/g) || []).length,
  };

  const totalComplexity = Object.values(complexityIndicators).reduce((a, b) => a + b, 0);

  if (totalComplexity > 20) {
    reasoning.push(`Alta complexidade detectada: ${totalComplexity} indicadores (condicionais, loops, async, error handling)`);
  }

  if (complexityIndicators.errorHandling > 5) {
    reasoning.push(`Múltiplos pontos de tratamento de erro (${complexityIndicators.errorHandling}) - requer testes de sad path`);
  }

  // Estimate risk
  let estimatedRisk: 'high' | 'medium' | 'low' = 'low';
  
  if (criticalPathsImpacted.length > 0 || totalComplexity > 30) {
    estimatedRisk = 'high';
    reasoning.push('Risco alto devido a caminhos críticos ou alta complexidade');
  } else if (sourceFiles.length > 5 || totalComplexity > 15) {
    estimatedRisk = 'medium';
    reasoning.push('Risco médio devido ao número de arquivos ou complexidade moderada');
  } else {
    reasoning.push('Risco baixo - mudanças simples ou bem cobertas por testes');
  }

  // Add reasoning about test coverage
  if (testFiles.length === 0 && sourceFiles.length > 0) {
    reasoning.push(`Nenhum arquivo de teste modificado (${sourceFiles.length} arquivo(s) fonte alterado(s))`);
  } else if (testFiles.length > 0) {
    reasoning.push(`${testFiles.length} arquivo(s) de teste modificado(s) - boa prática!`);
  }

  return {
    estimatedRisk,
    criticalPathsImpacted,
    testFilesFound: testFiles.length,
    suggestions: suggestions.slice(0, 10),
    reasoning,
  };
}

function generateCoverageSuggestions(
  report: CoverageReport,
  impactedFiles: string[],
  allChangedFiles: string[]
): CoverageSuggestion[] {
  const suggestions: CoverageSuggestion[] = [];

  // Prioritize files that were changed in the PR
  for (const filePath of impactedFiles) {
    const fileCoverage = report.files.find(f => 
      f.path.includes(filePath) || filePath.includes(f.path)
    );

    if (!fileCoverage) continue;

    // Check if it's a critical path
    const isCritical = CRITICAL_PATHS.some(cp => filePath.toLowerCase().includes(cp));
    const minThreshold = isCritical ? MIN_COVERAGE_THRESHOLD : 50;

    // Low coverage files
    if (fileCoverage.metrics.lines.percentage < minThreshold) {
      suggestions.push({
        priority: isCritical ? 'high' : 'medium',
        file: filePath,
        area: isCritical ? 'Caminho crítico com baixa cobertura' : 'Cobertura geral baixa',
        reason: `${fileCoverage.metrics.lines.percentage.toFixed(1)}% cobertura (mínimo: ${minThreshold}%)`,
        testType: 'unit',
      });
    }

    // Uncovered functions
    if (fileCoverage.metrics.functions.total > 0 && 
        fileCoverage.metrics.functions.percentage < 80) {
      const uncoveredCount = fileCoverage.metrics.functions.total - fileCoverage.metrics.functions.covered;
      suggestions.push({
        priority: 'medium',
        file: filePath,
        area: 'Funções não cobertas',
        reason: `${uncoveredCount} função(ões) sem cobertura de teste`,
        testType: 'unit',
      });
    }

    // Uncovered branches (important for edge cases)
    if (fileCoverage.metrics.branches.total > 0 && 
        fileCoverage.metrics.branches.percentage < 70) {
      suggestions.push({
        priority: 'medium',
        file: filePath,
        area: 'Branches não cobertos',
        reason: `${fileCoverage.metrics.branches.total - fileCoverage.metrics.branches.covered} branch(es) não testado(s) - possíveis edge cases`,
        testType: 'unit',
      });
    }
  }

  // Check for critical paths in changed files without coverage data
  for (const filePath of allChangedFiles) {
    if (impactedFiles.includes(filePath)) continue;
    
    const isCritical = CRITICAL_PATHS.some(cp => filePath.toLowerCase().includes(cp));
    if (isCritical) {
      suggestions.push({
        priority: 'high',
        file: filePath,
        area: 'Caminho crítico sem dados de cobertura',
        reason: `Arquivo em área sensível sem cobertura conhecida`,
        testType: 'unit',
      });
    }
  }

  // Sort by priority
  const priorityOrder = { high: 0, medium: 1, low: 2 };
  suggestions.sort((a, b) => priorityOrder[a.priority] - priorityOrder[b.priority]);

  return suggestions.slice(0, 10); // Limit to top 10
}

// =============================================================================
// Formatting
// =============================================================================

export function formatCoverageSection(result: CoverageAnalysisResult): string {
  const lines: string[] = ['### 📊 Análise de Cobertura', ''];

  // If we have real coverage data
  if (result.found && result.report) {
    const { overall } = result.report;

    // Overall metrics
    lines.push('| Métrica | Cobertura |');
    lines.push('|---------|-----------|');
    lines.push(`| Linhas | ${formatPercentage(overall.lines.percentage)} |`);
    lines.push(`| Branches | ${formatPercentage(overall.branches.percentage)} |`);
    lines.push(`| Funções | ${formatPercentage(overall.functions.percentage)} |`);
    lines.push('');

    // Check threshold
    if (overall.lines.percentage < MIN_COVERAGE_THRESHOLD) {
      lines.push(`> ⚠️ Cobertura abaixo do mínimo recomendado (${MIN_COVERAGE_THRESHOLD}%)`);
      lines.push('');
    }
  } else if (result.heuristicAnalysis) {
    // Heuristic analysis when no real coverage
    const h = result.heuristicAnalysis;
    
    lines.push('> ℹ️ **Análise heurística** - nenhum relatório de cobertura encontrado no repositório');
    lines.push('');

    // Risk badge
    const riskEmoji = h.estimatedRisk === 'high' ? '🔴' : h.estimatedRisk === 'medium' ? '🟡' : '🟢';
    lines.push(`**Risco estimado:** ${riskEmoji} ${h.estimatedRisk.toUpperCase()}`);
    lines.push('');

    // Critical paths
    if (h.criticalPathsImpacted.length > 0) {
      lines.push('**⚠️ Caminhos críticos impactados:**');
      for (const path of h.criticalPathsImpacted.slice(0, 5)) {
        lines.push(`- \`${path}\``);
      }
      lines.push('');
    }

    // Test files
    if (h.testFilesFound > 0) {
      lines.push(`✅ **${h.testFilesFound}** arquivo(s) de teste modificado(s)`);
    } else {
      lines.push('⚠️ Nenhum arquivo de teste foi modificado neste PR');
    }
    lines.push('');

    // Reasoning
    if (h.reasoning.length > 0) {
      lines.push('<details>');
      lines.push('<summary>📝 Detalhes da análise</summary>');
      lines.push('');
      for (const reason of h.reasoning) {
        lines.push(`- ${reason}`);
      }
      lines.push('');
      lines.push('</details>');
      lines.push('');
    }
  } else {
    // No coverage data at all
    return '';
  }

  // Suggestions (for both real and heuristic)
  if (result.suggestions.length > 0) {
    lines.push('#### 💡 Sugestões de Cobertura');
    lines.push('');
    
    for (const suggestion of result.suggestions) {
      const priorityEmoji = suggestion.priority === 'high' ? '🔴' : 
                           suggestion.priority === 'medium' ? '🟡' : '🟢';
      lines.push(`- ${priorityEmoji} **${suggestion.file}**: ${suggestion.reason}`);
    }
    lines.push('');
  }

  return lines.join('\n');
}

function formatPercentage(value: number): string {
  const emoji = value >= 80 ? '🟢' : value >= 50 ? '🟡' : '🔴';
  return `${emoji} ${value.toFixed(1)}%`;
}

