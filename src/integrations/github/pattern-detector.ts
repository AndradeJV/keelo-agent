import { logger } from '../../config/index.js';
import { createOctokitForInstallation } from './client.js';
import type { Octokit } from '@octokit/rest';
import type { PullRequestContext } from '../../core/types.js';

// =============================================================================
// Types
// =============================================================================

export interface TestPattern {
  detected: boolean;
  framework: 'playwright' | 'cypress' | 'jest' | 'vitest' | 'mocha' | 'unknown';
  structure: TestStructure;
  examples: TestExample[];
  configFile?: string;
}

export interface TestStructure {
  type: 'pom' | 'flat' | 'feature-based' | 'unknown';
  testsDir: string;
  pagesDir?: string;
  utilsDir?: string;
  fixturesDir?: string;
  configPath?: string;
}

export interface TestExample {
  path: string;
  content: string;
  type: 'test' | 'page' | 'util' | 'fixture' | 'config';
}

// Default POM structure
export const DEFAULT_POM_STRUCTURE: TestStructure = {
  type: 'pom',
  testsDir: 'e2e/tests',
  pagesDir: 'e2e/pages',
  utilsDir: 'e2e/utils',
  fixturesDir: 'e2e/fixtures',
};

// =============================================================================
// Pattern Detection
// =============================================================================

export async function detectTestPattern(
  context: PullRequestContext
): Promise<TestPattern> {
  const octokit = createOctokitForInstallation(context.installationId);
  
  logger.info({ repo: `${context.owner}/${context.repo}` }, 'Detecting test patterns...');

  const result: TestPattern = {
    detected: false,
    framework: 'unknown',
    structure: { ...DEFAULT_POM_STRUCTURE },
    examples: [],
  };

  try {
    // Check for test framework config files
    const frameworkConfig = await detectFramework(octokit, context);
    if (frameworkConfig) {
      result.framework = frameworkConfig.framework;
      result.configFile = frameworkConfig.configPath;
      result.detected = true;
    }

    // Detect test structure
    const structure = await detectStructure(octokit, context);
    if (structure) {
      result.structure = structure;
      result.detected = true;
    }

    // Get example files for context
    if (result.detected) {
      result.examples = await getTestExamples(octokit, context, result.structure);
    }

    logger.info({ 
      detected: result.detected,
      framework: result.framework,
      structureType: result.structure.type,
      examplesCount: result.examples.length 
    }, 'Test pattern detection completed');

  } catch (error) {
    logger.warn({ error }, 'Failed to detect test patterns, using defaults');
  }

  return result;
}

// =============================================================================
// Framework Detection
// =============================================================================

interface FrameworkConfig {
  framework: TestPattern['framework'];
  configPath: string;
}

const FRAMEWORK_CONFIG_FILES: Record<string, TestPattern['framework']> = {
  'playwright.config.ts': 'playwright',
  'playwright.config.js': 'playwright',
  'cypress.config.ts': 'cypress',
  'cypress.config.js': 'cypress',
  'cypress.json': 'cypress',
  'jest.config.ts': 'jest',
  'jest.config.js': 'jest',
  'vitest.config.ts': 'vitest',
  'vitest.config.js': 'vitest',
  'vite.config.ts': 'vitest', // vitest often uses vite config
};

async function detectFramework(
  octokit: Octokit,
  context: PullRequestContext
): Promise<FrameworkConfig | null> {
  for (const [filename, framework] of Object.entries(FRAMEWORK_CONFIG_FILES)) {
    try {
      await octokit.repos.getContent({
        owner: context.owner,
        repo: context.repo,
        path: filename,
      });
      
      return { framework, configPath: filename };
    } catch {
      // File doesn't exist, continue
    }
  }

  // Check package.json for test dependencies
  try {
    const pkg = await octokit.repos.getContent({
      owner: context.owner,
      repo: context.repo,
      path: 'package.json',
    });

    if ('content' in pkg.data) {
      const content = Buffer.from(pkg.data.content, 'base64').toString('utf-8');
      const packageJson = JSON.parse(content);
      const allDeps = {
        ...packageJson.dependencies,
        ...packageJson.devDependencies,
      };

      if (allDeps['@playwright/test']) return { framework: 'playwright', configPath: 'package.json' };
      if (allDeps['cypress']) return { framework: 'cypress', configPath: 'package.json' };
      if (allDeps['vitest']) return { framework: 'vitest', configPath: 'package.json' };
      if (allDeps['jest']) return { framework: 'jest', configPath: 'package.json' };
    }
  } catch {
    // No package.json
  }

  return null;
}

// =============================================================================
// Structure Detection
// =============================================================================

const COMMON_TEST_DIRS = [
  // POM structure
  { test: 'e2e/tests', pages: 'e2e/pages', utils: 'e2e/utils', type: 'pom' as const },
  { test: 'tests/e2e', pages: 'tests/pages', utils: 'tests/utils', type: 'pom' as const },
  { test: 'test/e2e', pages: 'test/pages', utils: 'test/utils', type: 'pom' as const },
  
  // Playwright default
  { test: 'tests', pages: 'tests/pages', utils: 'tests/utils', type: 'pom' as const },
  { test: 'e2e', pages: 'e2e/pages', utils: 'e2e/utils', type: 'pom' as const },
  
  // Cypress structure
  { test: 'cypress/e2e', pages: 'cypress/support/pages', utils: 'cypress/support', type: 'pom' as const },
  { test: 'cypress/integration', pages: 'cypress/support/pages', utils: 'cypress/support', type: 'pom' as const },
  
  // Flat structure
  { test: '__tests__', type: 'flat' as const },
  { test: 'spec', type: 'flat' as const },
  { test: 'test', type: 'flat' as const },
];

async function detectStructure(
  octokit: Octokit,
  context: PullRequestContext
): Promise<TestStructure | null> {
  for (const dir of COMMON_TEST_DIRS) {
    try {
      await octokit.repos.getContent({
        owner: context.owner,
        repo: context.repo,
        path: dir.test,
      });

      // Directory exists, check for pages/utils if POM
      const structure: TestStructure = {
        type: dir.type,
        testsDir: dir.test,
      };

      if (dir.type === 'pom' && 'pages' in dir && dir.pages) {
        try {
          await octokit.repos.getContent({
            owner: context.owner,
            repo: context.repo,
            path: dir.pages,
          });
          structure.pagesDir = dir.pages;
        } catch {
          // No pages dir
        }
      }

      if (dir.type === 'pom' && 'utils' in dir && dir.utils) {
        try {
          await octokit.repos.getContent({
            owner: context.owner,
            repo: context.repo,
            path: dir.utils,
          });
          structure.utilsDir = dir.utils;
        } catch {
          // No utils dir
        }
      }

      return structure;
    } catch {
      // Directory doesn't exist
    }
  }

  return null;
}

// =============================================================================
// Example Extraction
// =============================================================================

async function getTestExamples(
  octokit: Octokit,
  context: PullRequestContext,
  structure: TestStructure
): Promise<TestExample[]> {
  const examples: TestExample[] = [];
  const maxExamples = 3;

  // Get test file examples
  const testFiles = await getFilesFromDir(octokit, context, structure.testsDir);
  for (const file of testFiles.slice(0, maxExamples)) {
    const content = await getFileContent(octokit, context, file);
    if (content) {
      examples.push({ path: file, content, type: 'test' });
    }
  }

  // Get page object examples
  if (structure.pagesDir) {
    const pageFiles = await getFilesFromDir(octokit, context, structure.pagesDir);
    for (const file of pageFiles.slice(0, 2)) {
      const content = await getFileContent(octokit, context, file);
      if (content) {
        examples.push({ path: file, content, type: 'page' });
      }
    }
  }

  // Get util examples
  if (structure.utilsDir) {
    const utilFiles = await getFilesFromDir(octokit, context, structure.utilsDir);
    for (const file of utilFiles.slice(0, 1)) {
      const content = await getFileContent(octokit, context, file);
      if (content) {
        examples.push({ path: file, content, type: 'util' });
      }
    }
  }

  return examples;
}

async function getFilesFromDir(
  octokit: Octokit,
  context: PullRequestContext,
  dirPath: string
): Promise<string[]> {
  try {
    const response = await octokit.repos.getContent({
      owner: context.owner,
      repo: context.repo,
      path: dirPath,
    });

    if (Array.isArray(response.data)) {
      return response.data
        .filter(item => item.type === 'file' && /\.(ts|js|tsx|jsx)$/.test(item.name))
        .map(item => item.path);
    }
  } catch {
    // Directory doesn't exist
  }

  return [];
}

async function getFileContent(
  octokit: Octokit,
  context: PullRequestContext,
  filePath: string
): Promise<string | null> {
  try {
    const response = await octokit.repos.getContent({
      owner: context.owner,
      repo: context.repo,
      path: filePath,
    });

    if ('content' in response.data) {
      const content = Buffer.from(response.data.content, 'base64').toString('utf-8');
      // Limit content size
      return content.substring(0, 3000);
    }
  } catch {
    // File doesn't exist
  }

  return null;
}

// =============================================================================
// Pattern Summary
// =============================================================================

export function formatPatternSummary(pattern: TestPattern): string {
  if (!pattern.detected) {
    return `**Test Pattern:** No existing tests detected. Will use POM structure:
- \`e2e/tests/\` - Test files
- \`e2e/pages/\` - Page Objects
- \`e2e/utils/\` - Utility functions`;
  }

  const lines = [
    `**Test Pattern Detected:**`,
    `- Framework: ${pattern.framework}`,
    `- Structure: ${pattern.structure.type}`,
    `- Tests: \`${pattern.structure.testsDir}/\``,
  ];

  if (pattern.structure.pagesDir) {
    lines.push(`- Pages: \`${pattern.structure.pagesDir}/\``);
  }
  if (pattern.structure.utilsDir) {
    lines.push(`- Utils: \`${pattern.structure.utilsDir}/\``);
  }

  return lines.join('\n');
}
