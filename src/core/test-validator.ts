import { logger } from '../config/index.js';
import ts from 'typescript';

// =============================================================================
// Types
// =============================================================================

export interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
  warnings: ValidationWarning[];
}

export interface ValidationError {
  line?: number;
  column?: number;
  message: string;
  code?: string;
}

export interface ValidationWarning {
  message: string;
  suggestion?: string;
}

// =============================================================================
// Syntax Validation using TypeScript Compiler
// =============================================================================

export function validateTestSyntax(code: string, filename: string): ValidationResult {
  const result: ValidationResult = {
    valid: true,
    errors: [],
    warnings: [],
  };

  // Step 1: TypeScript syntax check
  const syntaxErrors = checkTypeScriptSyntax(code, filename);
  if (syntaxErrors.length > 0) {
    result.valid = false;
    result.errors.push(...syntaxErrors);
  }

  // Step 2: Structural validation (test-specific)
  const structuralWarnings = validateTestStructure(code, filename);
  result.warnings.push(...structuralWarnings);

  // Step 3: Common issues detection
  const commonIssues = detectCommonIssues(code);
  result.warnings.push(...commonIssues);

  return result;
}

function checkTypeScriptSyntax(code: string, filename: string): ValidationError[] {
  const errors: ValidationError[] = [];

  try {
    // Create a simple compiler host for syntax checking only
    const compilerOptions: ts.CompilerOptions = {
      target: ts.ScriptTarget.ESNext,
      module: ts.ModuleKind.ESNext,
      moduleResolution: ts.ModuleResolutionKind.Bundler,
      strict: false, // Relaxed - we only care about syntax
      noEmit: true,
      skipLibCheck: true,
      allowJs: true,
      esModuleInterop: true,
    };

    // Parse the source file
    const sourceFile = ts.createSourceFile(
      filename,
      code,
      ts.ScriptTarget.ESNext,
      true,
      filename.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS
    );

    // Check for parse errors (syntax errors)
    const parseErrors = (sourceFile as unknown as { parseDiagnostics?: ts.Diagnostic[] }).parseDiagnostics || [];
    
    for (const diagnostic of parseErrors) {
      const position = diagnostic.start !== undefined
        ? sourceFile.getLineAndCharacterOfPosition(diagnostic.start)
        : undefined;

      errors.push({
        line: position ? position.line + 1 : undefined,
        column: position ? position.character + 1 : undefined,
        message: ts.flattenDiagnosticMessageText(diagnostic.messageText, '\n'),
        code: `TS${diagnostic.code}`,
      });
    }

    // Also do a quick syntactic diagnostic check
    const syntacticDiagnostics = ts.createProgram({
      rootNames: [filename],
      options: compilerOptions,
      host: createInMemoryCompilerHost(filename, code, compilerOptions),
    }).getSyntacticDiagnostics(sourceFile);

    for (const diagnostic of syntacticDiagnostics) {
      if (diagnostic.file && diagnostic.start !== undefined) {
        const position = diagnostic.file.getLineAndCharacterOfPosition(diagnostic.start);
        errors.push({
          line: position.line + 1,
          column: position.character + 1,
          message: ts.flattenDiagnosticMessageText(diagnostic.messageText, '\n'),
          code: `TS${diagnostic.code}`,
        });
      }
    }

  } catch (error) {
    errors.push({
      message: `Failed to parse: ${error instanceof Error ? error.message : 'Unknown error'}`,
    });
  }

  return errors;
}

function createInMemoryCompilerHost(
  filename: string,
  code: string,
  options: ts.CompilerOptions
): ts.CompilerHost {
  const defaultHost = ts.createCompilerHost(options);
  
  return {
    ...defaultHost,
    fileExists: (path) => path === filename || defaultHost.fileExists(path),
    readFile: (path) => path === filename ? code : defaultHost.readFile(path),
    getSourceFile: (path, languageVersion) => {
      if (path === filename) {
        return ts.createSourceFile(path, code, languageVersion, true);
      }
      return defaultHost.getSourceFile(path, languageVersion);
    },
  };
}

// =============================================================================
// Structural Validation
// =============================================================================

function validateTestStructure(code: string, filename: string): ValidationWarning[] {
  const warnings: ValidationWarning[] = [];

  // Check for test framework imports
  const hasPlaywrightImport = /import\s+.*from\s+['"]@playwright\/test['"]/.test(code);
  const hasVitestImport = /import\s+.*from\s+['"]vitest['"]/.test(code);
  const hasJestImport = /import\s+.*from\s+['"]@jest/.test(code) || /describe|it|test/.test(code);

  if (!hasPlaywrightImport && !hasVitestImport && !hasJestImport) {
    warnings.push({
      message: 'No test framework import detected',
      suggestion: 'Add import { test, expect } from "@playwright/test" or similar',
    });
  }

  // Check for test blocks
  const hasTestBlocks = /\b(test|it)\s*\(/.test(code);
  const hasDescribeBlocks = /\bdescribe\s*\(/.test(code);

  if (!hasTestBlocks) {
    warnings.push({
      message: 'No test() or it() blocks found',
      suggestion: 'Ensure the test file contains at least one test block',
    });
  }

  // Check for assertions in Playwright tests
  if (hasPlaywrightImport) {
    const hasExpect = /\bexpect\s*\(/.test(code);
    const hasToHave = /\.toHave|\.toBe|\.toEqual|\.toContain/.test(code);
    
    if (!hasExpect && !hasToHave) {
      warnings.push({
        message: 'No assertions (expect) found in Playwright test',
        suggestion: 'Add expect() assertions to verify test outcomes',
      });
    }
  }

  // Check for async/await in e2e tests
  if (hasPlaywrightImport && !code.includes('async')) {
    warnings.push({
      message: 'Playwright test may be missing async',
      suggestion: 'Playwright tests typically require async ({ page }) => { ... }',
    });
  }

  return warnings;
}

// =============================================================================
// Common Issues Detection
// =============================================================================

function detectCommonIssues(code: string): ValidationWarning[] {
  const warnings: ValidationWarning[] = [];

  // Placeholder detection
  const placeholders = [
    /\/\/\s*\.\.\./,
    /\/\/\s*TODO/i,
    /\/\/\s*FIXME/i,
    /PLACEHOLDER/i,
    /\.\.\.implementation/i,
    /\/\*\s*\.\.\.\s*\*\//,
  ];

  for (const pattern of placeholders) {
    if (pattern.test(code)) {
      warnings.push({
        message: 'Possible placeholder or incomplete code detected',
        suggestion: 'Ensure all code is complete and executable',
      });
      break;
    }
  }

  // Hardcoded localhost that might not work
  if (/localhost:\d+/.test(code) && !code.includes('baseURL')) {
    warnings.push({
      message: 'Hardcoded localhost URL detected',
      suggestion: 'Consider using baseURL from Playwright config',
    });
  }

  // Empty test blocks
  if (/test\([^)]+,\s*async\s*\([^)]*\)\s*=>\s*\{\s*\}/.test(code)) {
    warnings.push({
      message: 'Empty test block detected',
      suggestion: 'Test should contain actual test logic',
    });
  }

  // Missing page actions in Playwright
  if (/page\s*\)/.test(code)) {
    const hasPageAction = /page\.(goto|click|fill|locator|getByRole|getByText|getByTestId)/.test(code);
    if (!hasPageAction) {
      warnings.push({
        message: 'Playwright test receives page but no page actions found',
        suggestion: 'Add page interactions like page.goto(), page.click(), etc.',
      });
    }
  }

  return warnings;
}

// =============================================================================
// Batch Validation
// =============================================================================

export interface BatchValidationResult {
  totalTests: number;
  validTests: number;
  invalidTests: number;
  results: Map<string, ValidationResult>;
}

export function validateTestBatch(
  tests: Array<{ filename: string; code: string }>
): BatchValidationResult {
  const results = new Map<string, ValidationResult>();
  let validCount = 0;
  let invalidCount = 0;

  for (const test of tests) {
    const result = validateTestSyntax(test.code, test.filename);
    results.set(test.filename, result);

    if (result.valid) {
      validCount++;
    } else {
      invalidCount++;
      logger.warn({
        filename: test.filename,
        errors: result.errors,
      }, 'Test validation failed');
    }

    // Log warnings even for valid tests
    if (result.warnings.length > 0) {
      logger.debug({
        filename: test.filename,
        warnings: result.warnings,
      }, 'Test validation warnings');
    }
  }

  logger.info({
    total: tests.length,
    valid: validCount,
    invalid: invalidCount,
  }, 'Batch validation completed');

  return {
    totalTests: tests.length,
    validTests: validCount,
    invalidTests: invalidCount,
    results,
  };
}

// =============================================================================
// Fix Suggestions
// =============================================================================

export function generateFixSuggestions(result: ValidationResult): string[] {
  const suggestions: string[] = [];

  for (const error of result.errors) {
    if (error.message.includes('expected')) {
      suggestions.push(`Syntax error at line ${error.line}: ${error.message}`);
    }
    if (error.message.includes('Unexpected token')) {
      suggestions.push(`Check for missing brackets, parentheses, or semicolons around line ${error.line}`);
    }
  }

  for (const warning of result.warnings) {
    if (warning.suggestion) {
      suggestions.push(warning.suggestion);
    }
  }

  return suggestions;
}

