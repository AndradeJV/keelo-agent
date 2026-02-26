import { 
  query, 
  queryOne, 
  queryAll, 
  withTransaction,
  isDatabaseEnabled 
} from '../connection.js';
import { logger } from '../../config/index.js';
import type { AnalysisResult, TestScenario, RiskLevel } from '../../core/types.js';
import type { RequirementsAnalysisResult, PreImplementationScenario } from '../../core/requirements-analyzer.js';
import type { PoolClient } from 'pg';

// =============================================================================
// Types
// =============================================================================

export type TriggerSource = 'auto' | 'command' | 'silent';

export interface AnalysisRecord {
  id: string;
  type: 'pr' | 'requirements' | 'figma' | 'user_story';
  status: 'pending' | 'processing' | 'completed' | 'failed';
  version: string;
  trigger_source?: TriggerSource;
  repository_id?: string;
  pr_number?: number;
  pr_title?: string;
  pr_url?: string;
  feature_name?: string;
  project_name?: string;
  sprint?: string;
  overall_risk?: RiskLevel;
  summary_title?: string;
  summary_description?: string;
  complexity?: string;
  scenarios_count: number;
  risks_count: number;
  gaps_count: number;
  criteria_count: number;
  input_data?: Record<string, unknown>;
  result_data?: Record<string, unknown>;
  thumbs_up: number;
  thumbs_down: number;
  was_helpful?: boolean;
  created_at: Date;
  completed_at?: Date;
  error_message?: string;
  // Multi-tenancy fields
  user_id?: string;
  project_id?: string;
  organization_id?: string;
}

export interface RepositoryRecord {
  id: string;
  owner: string;
  name: string;
  full_name: string;
  installation_id?: number;
  created_at: Date;
  updated_at: Date;
}

export interface AnalysisFilter {
  type?: 'pr' | 'requirements' | 'figma' | 'user_story';
  triggerSource?: TriggerSource;
  repositoryId?: string;
  repositoryFullName?: string;
  status?: string;
  overallRisk?: RiskLevel;
  fromDate?: Date;
  toDate?: Date;
  limit?: number;
  offset?: number;
  userId?: string;
  isAdmin?: boolean;
  projectId?: string;
  organizationId?: string;
}

// =============================================================================
// Repository Operations
// =============================================================================

export async function findOrCreateRepository(
  owner: string,
  name: string,
  installationId?: number
): Promise<RepositoryRecord> {
  if (!isDatabaseEnabled()) {
    throw new Error('Database not enabled');
  }

  const existing = await queryOne<RepositoryRecord>(
    'SELECT * FROM repositories WHERE owner = $1 AND name = $2',
    [owner, name]
  );

  if (existing) {
    if (installationId && existing.installation_id !== installationId) {
      await query(
        'UPDATE repositories SET installation_id = $1 WHERE id = $2',
        [installationId, existing.id]
      );
    }
    return existing;
  }

  const result = await queryOne<RepositoryRecord>(
    `INSERT INTO repositories (owner, name, installation_id) 
     VALUES ($1, $2, $3) 
     RETURNING *`,
    [owner, name, installationId]
  );

  return result!;
}

export interface RepositoryWithStats {
  id: string;
  owner: string;
  name: string;
  full_name: string;
  installation_id?: number;
  analysis_count: number;
  last_analysis_at?: string;
}

/**
 * Get all repositories with analysis counts
 */
export async function getRepositories(userId?: string, isAdmin = false, organizationId?: string): Promise<RepositoryWithStats[]> {
  if (!isDatabaseEnabled()) {
    return [];
  }

  const params: unknown[] = [];
  let userFilter = '';

  if (organizationId) {
    params.push(organizationId);
    userFilter = `WHERE r.organization_id = $1`;
  } else if (userId && !isAdmin) {
    params.push(userId);
    userFilter = `WHERE r.user_id = $1`;
  }

  const results = await queryAll<RepositoryWithStats>(
    `SELECT 
      r.id,
      r.owner,
      r.name,
      r.full_name,
      r.installation_id,
      COUNT(a.id) as analysis_count,
      MAX(a.created_at) as last_analysis_at
    FROM repositories r
    LEFT JOIN analyses a ON a.repository_id = r.id
    ${userFilter}
    GROUP BY r.id, r.owner, r.name, r.full_name, r.installation_id
    ORDER BY analysis_count DESC, r.full_name ASC`,
    params.length > 0 ? params : undefined
  );

  return results.map(r => ({
    ...r,
    analysis_count: parseInt(String(r.analysis_count), 10) || 0,
  }));
}

/**
 * Create a repository manually
 */
export async function createRepository(
  fullName: string,
  userId?: string
): Promise<RepositoryRecord | null> {
  if (!isDatabaseEnabled()) {
    return null;
  }

  const [owner, name] = fullName.split('/');
  if (!owner || !name) {
    throw new Error('Invalid repository format. Use: owner/name');
  }

  // Check if already exists for this user
  const existingParams: unknown[] = [owner, name];
  let existingQuery = 'SELECT * FROM repositories WHERE owner = $1 AND name = $2';
  if (userId) {
    existingQuery += ' AND user_id = $3';
    existingParams.push(userId);
  }

  const existing = await queryOne<RepositoryRecord>(existingQuery, existingParams);

  if (existing) {
    return existing;
  }

  const result = await queryOne<RepositoryRecord>(
    `INSERT INTO repositories (owner, name, user_id) 
     VALUES ($1, $2, $3) 
     RETURNING *`,
    [owner, name, userId || null]
  );

  return result;
}

/**
 * Delete a repository and all its associated data
 */
export async function deleteRepository(id: string, userId?: string, isAdmin = false): Promise<boolean> {
  if (!isDatabaseEnabled()) {
    return false;
  }

  // Delete the repository (CASCADE will handle related records)
  // Non-admin users can only delete their own repositories
  let sql = 'DELETE FROM repositories WHERE id = $1';
  const params: unknown[] = [id];

  if (userId && !isAdmin) {
    sql += ' AND user_id = $2';
    params.push(userId);
  }

  const result = await query(sql, params);
  return (result.rowCount ?? 0) > 0;
}

/**
 * Get a repository by ID
 */
export async function getRepositoryById(id: string): Promise<RepositoryRecord | null> {
  if (!isDatabaseEnabled()) {
    return null;
  }

  return queryOne<RepositoryRecord>(
    'SELECT * FROM repositories WHERE id = $1',
    [id]
  );
}

// =============================================================================
// Analysis Operations
// =============================================================================

export async function createPRAnalysis(
  context: {
    owner: string;
    repo: string;
    pullNumber: number;
    title: string;
    installationId: number;
    triggerSource?: TriggerSource;
  },
  analysis: AnalysisResult
): Promise<string> {
  if (!isDatabaseEnabled()) {
    logger.debug('Database not enabled, skipping analysis save');
    return '';
  }

  return withTransaction(async (client: PoolClient) => {
    // Find or create repository
    const repoResult = await client.query<RepositoryRecord>(
      `INSERT INTO repositories (owner, name, installation_id) 
       VALUES ($1, $2, $3) 
       ON CONFLICT (owner, name) DO UPDATE SET installation_id = $3
       RETURNING *`,
      [context.owner, context.repo, context.installationId]
    );
    const repository = repoResult.rows[0];

    // Create analysis record
    const analysisResult = await client.query<{ id: string }>(
      `INSERT INTO analyses (
        type, status, version, repository_id, 
        pr_number, pr_title, pr_url,
        overall_risk, summary_title, summary_description,
        scenarios_count, risks_count, gaps_count,
        result_data, trigger_source, completed_at
      ) VALUES (
        'pr', 'completed', $1, $2,
        $3, $4, $5,
        $6, $7, $8,
        $9, $10, $11,
        $12, $13, NOW()
      ) RETURNING id`,
      [
        analysis.version || '1.0.0',
        repository.id,
        context.pullNumber,
        context.title,
        `https://github.com/${context.owner}/${context.repo}/pull/${context.pullNumber}`,
        analysis.overallRisk,
        analysis.summary?.title || 'PR Analysis',
        analysis.summary?.description || '',
        analysis.scenarios?.length || 0,
        analysis.risks?.length || 0,
        analysis.gaps?.length || 0,
        JSON.stringify(analysis),
        context.triggerSource || 'auto',
      ]
    );

    const analysisId = analysisResult.rows[0].id;

    // Save scenarios
    if (analysis.scenarios?.length) {
      for (const scenario of analysis.scenarios) {
        await client.query(
          `INSERT INTO test_scenarios (
            analysis_id, scenario_id, title, category, priority,
            preconditions, steps, expected_result, test_type, heuristic
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
          [
            analysisId,
            scenario.id,
            scenario.title,
            scenario.category,
            scenario.priority,
            scenario.preconditions || [],
            scenario.steps || [],
            scenario.expectedResult,
            scenario.testType,
            scenario.heuristic,
          ]
        );
      }
    }

    // Save risks
    if (analysis.risks?.length) {
      for (const risk of analysis.risks) {
        await client.query(
          `INSERT INTO risks (analysis_id, title, area, description, severity)
           VALUES ($1, $2, $3, $4, $5)`,
          [analysisId, risk.area, risk.area, risk.description, risk.level]
        );
      }
    }

    // Save gaps
    if (analysis.gaps?.length) {
      for (const gap of analysis.gaps) {
        await client.query(
          `INSERT INTO gaps (analysis_id, title, description, recommendation, severity)
           VALUES ($1, $2, $3, $4, $5)`,
          [analysisId, gap.title, gap.recommendation, gap.recommendation, gap.severity]
        );
      }
    }

    // Save Playwright test suggestions
    if (analysis.playwrightTests?.length) {
      for (const test of analysis.playwrightTests) {
        await client.query(
          `INSERT INTO playwright_suggestions (analysis_id, name, description, code)
           VALUES ($1, $2, $3, $4)`,
          [analysisId, test.name, test.description, test.code]
        );
      }
    }

    logger.info({ analysisId, prNumber: context.pullNumber }, 'PR analysis saved to database');
    return analysisId;
  });
}

export async function createRequirementsAnalysis(
  input: {
    projectName?: string;
    featureName?: string;
    sprint?: string;
  },
  analysis: RequirementsAnalysisResult,
  userId?: string,
  projectId?: string,
  organizationId?: string
): Promise<string> {
  if (!isDatabaseEnabled()) {
    logger.debug('Database not enabled, skipping analysis save');
    return '';
  }

  return withTransaction(async (client: PoolClient) => {
    // Create analysis record
    const analysisResult = await client.query<{ id: string }>(
      `INSERT INTO analyses (
        type, status, version,
        project_name, feature_name, sprint,
        overall_risk, summary_title, summary_description, complexity,
        scenarios_count, risks_count, gaps_count, criteria_count,
        result_data, user_id, project_id, organization_id, completed_at
      ) VALUES (
        'requirements', 'completed', $1,
        $2, $3, $4,
        $5, $6, $7, $8,
        $9, $10, $11, $12,
        $13, $14, $15, $16, NOW()
      ) RETURNING id`,
      [
        analysis.version || '1.0.0',
        input.projectName,
        input.featureName,
        input.sprint,
        analysis.risks?.[0]?.severity || 'medium',
        analysis.summary?.title || 'Requirements Analysis',
        analysis.summary?.description || '',
        analysis.summary?.complexity || 'medium',
        analysis.scenarios?.length || 0,
        analysis.risks?.length || 0,
        analysis.gaps?.length || 0,
        analysis.acceptanceCriteria?.length || 0,
        JSON.stringify(analysis),
        userId || null,
        projectId || null,
        organizationId || null,
      ]
    );

    const analysisId = analysisResult.rows[0].id;

    // Save scenarios
    if (analysis.scenarios?.length) {
      for (const scenario of analysis.scenarios) {
        await client.query(
          `INSERT INTO test_scenarios (
            analysis_id, scenario_id, title, category, priority,
            preconditions, steps, expected_result, 
            suggested_test_type, effort, test_data, dependencies, heuristic
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)`,
          [
            analysisId,
            scenario.id,
            scenario.title,
            scenario.category,
            scenario.priority,
            scenario.preconditions || [],
            scenario.steps || [],
            scenario.expectedResult,
            scenario.suggestedTestType,
            scenario.effort,
            scenario.testData || [],
            scenario.dependencies || [],
            scenario.heuristic,
          ]
        );
      }
    }

    // Save acceptance criteria
    if (analysis.acceptanceCriteria?.length) {
      for (const ac of analysis.acceptanceCriteria) {
        await client.query(
          `INSERT INTO acceptance_criteria (
            analysis_id, criteria_id, description, criteria_type,
            gherkin_given, gherkin_when, gherkin_then, automatable
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
          [
            analysisId,
            ac.id,
            ac.description,
            ac.type,
            ac.gherkin?.given,
            ac.gherkin?.when,
            ac.gherkin?.then,
            ac.automatable,
          ]
        );
      }
    }

    // Save risks
    if (analysis.risks?.length) {
      for (const risk of analysis.risks) {
        await client.query(
          `INSERT INTO risks (analysis_id, title, description, severity, mitigation, affected_areas)
           VALUES ($1, $2, $3, $4, $5, $6)`,
          [analysisId, risk.title, risk.description, risk.severity, risk.mitigation, risk.affectedAreas]
        );
      }
    }

    // Save gaps
    if (analysis.gaps?.length) {
      for (const gap of analysis.gaps) {
        await client.query(
          `INSERT INTO gaps (analysis_id, title, description, gap_type, question, severity)
           VALUES ($1, $2, $3, $4, $5, $6)`,
          [analysisId, gap.title, gap.description, gap.type, gap.question, gap.severity]
        );
      }
    }

    logger.info({ analysisId, featureName: input.featureName }, 'Requirements analysis saved to database');
    return analysisId;
  });
}

// =============================================================================
// Query Operations
// =============================================================================

export async function getAnalysisById(id: string): Promise<AnalysisRecord | null> {
  if (!isDatabaseEnabled()) return null;
  return queryOne<AnalysisRecord>('SELECT * FROM analyses WHERE id = $1', [id]);
}

export async function getAnalyses(filter: AnalysisFilter = {}): Promise<AnalysisRecord[]> {
  if (!isDatabaseEnabled()) return [];

  const conditions: string[] = [];
  const params: unknown[] = [];
  let paramIndex = 1;

  // Multi-tenancy: filter by organization/project (preferred) or user_id (legacy)
  if (filter.projectId) {
    conditions.push(`project_id = $${paramIndex++}`);
    params.push(filter.projectId);
  } else if (filter.organizationId) {
    conditions.push(`organization_id = $${paramIndex++}`);
    params.push(filter.organizationId);
  } else if (filter.userId && !filter.isAdmin) {
    conditions.push(`user_id = $${paramIndex++}`);
    params.push(filter.userId);
  }

  if (filter.type) {
    conditions.push(`type = $${paramIndex++}`);
    params.push(filter.type);
  }

  if (filter.repositoryId) {
    conditions.push(`repository_id = $${paramIndex++}`);
    params.push(filter.repositoryId);
  }

  if (filter.repositoryFullName) {
    conditions.push(`repository_id IN (SELECT id FROM repositories WHERE full_name = $${paramIndex++})`);
    params.push(filter.repositoryFullName);
  }

  if (filter.status) {
    conditions.push(`status = $${paramIndex++}`);
    params.push(filter.status);
  }

  if (filter.overallRisk) {
    conditions.push(`overall_risk = $${paramIndex++}`);
    params.push(filter.overallRisk);
  }

  if (filter.triggerSource) {
    conditions.push(`trigger_source = $${paramIndex++}`);
    params.push(filter.triggerSource);
  }

  if (filter.fromDate) {
    conditions.push(`created_at >= $${paramIndex++}`);
    params.push(filter.fromDate);
  }

  if (filter.toDate) {
    conditions.push(`created_at <= $${paramIndex++}`);
    params.push(filter.toDate);
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
  const limit = filter.limit || 50;
  const offset = filter.offset || 0;

  return queryAll<AnalysisRecord>(
    `SELECT * FROM analyses ${whereClause} 
     ORDER BY created_at DESC 
     LIMIT $${paramIndex++} OFFSET $${paramIndex}`,
    [...params, limit, offset]
  );
}

export interface PlaywrightSuggestion {
  name: string;
  description: string;
  code: string;
}

export async function getAnalysisSummary(id: string): Promise<{
  analysis: AnalysisRecord | null;
  scenarios: TestScenario[];
  risks: { 
    title: string; 
    severity: RiskLevel;
    area?: string;
    description?: string;
    mitigation?: string;
    probability?: string;
    impact?: string;
    tests_required?: string[];
  }[];
  gaps: { title: string; question: string; recommendation?: string; risk_if_ignored?: string }[];
  playwrightTests: PlaywrightSuggestion[];
  implementationPrompt?: string;
}> {
  if (!isDatabaseEnabled()) {
    return { analysis: null, scenarios: [], risks: [], gaps: [], playwrightTests: [] };
  }

  const analysis = await getAnalysisById(id);
  if (!analysis) {
    return { analysis: null, scenarios: [], risks: [], gaps: [], playwrightTests: [] };
  }

  const scenarios = await queryAll<TestScenario>(
    'SELECT * FROM test_scenarios WHERE analysis_id = $1',
    [id]
  );

  const risks = await queryAll<{ 
    title: string; 
    severity: RiskLevel;
    area?: string;
    description?: string;
    mitigation?: string;
  }>(
    'SELECT title, severity, area, description, mitigation FROM risks WHERE analysis_id = $1',
    [id]
  );

  const gaps = await queryAll<{ title: string; question: string; recommendation?: string }>(
    'SELECT title, question, recommendation FROM gaps WHERE analysis_id = $1',
    [id]
  );

  const playwrightTests = await queryAll<PlaywrightSuggestion>(
    'SELECT name, description, code FROM playwright_suggestions WHERE analysis_id = $1',
    [id]
  );

  // Extract implementationPrompt from result_data if available
  let implementationPrompt: string | undefined;
  if (analysis.result_data && typeof analysis.result_data === 'object') {
    const resultData = analysis.result_data as { implementationPrompt?: string };
    implementationPrompt = resultData.implementationPrompt;
  }

  return { analysis, scenarios, risks, gaps, playwrightTests, implementationPrompt };
}

export async function getPRAnalysisHistory(
  owner: string,
  repo: string,
  limit = 20
): Promise<AnalysisRecord[]> {
  if (!isDatabaseEnabled()) return [];

  return queryAll<AnalysisRecord>(
    `SELECT a.* FROM analyses a
     JOIN repositories r ON a.repository_id = r.id
     WHERE r.owner = $1 AND r.name = $2 AND a.type = 'pr'
     ORDER BY a.created_at DESC
     LIMIT $3`,
    [owner, repo, limit]
  );
}

export async function getStatistics(userId?: string, isAdmin = false, projectId?: string, organizationId?: string): Promise<{
  totalAnalyses: number;
  prAnalyses: number;
  requirementsAnalyses: number;
  completed: number;
  failed: number;
  avgScenarios: number;
  avgRisks: number;
  criticalCount: number;
  highCount: number;
  helpfulCount: number;
  notHelpfulCount: number;
}> {
  if (!isDatabaseEnabled()) {
    return {
      totalAnalyses: 0,
      prAnalyses: 0,
      requirementsAnalyses: 0,
      completed: 0,
      failed: 0,
      avgScenarios: 0,
      avgRisks: 0,
      criticalCount: 0,
      highCount: 0,
      helpfulCount: 0,
      notHelpfulCount: 0,
    };
  }

  // Build filter: project > organization > user
  let userFilter = '';
  let params: unknown[] | undefined;
  if (projectId) {
    userFilter = 'WHERE project_id = $1';
    params = [projectId];
  } else if (organizationId) {
    userFilter = 'WHERE organization_id = $1';
    params = [organizationId];
  } else if (userId && !isAdmin) {
    userFilter = 'WHERE user_id = $1';
    params = [userId];
  }

  const result = await queryOne<{
    total_analyses: string;
    pr_analyses: string;
    requirements_analyses: string;
    completed: string;
    failed: string;
    avg_scenarios: string;
    avg_risks: string;
    critical_count: string;
    high_count: string;
    helpful_count: string;
    not_helpful_count: string;
  }>(
    userFilter
      ? `SELECT
          COUNT(*) as total_analyses,
          COUNT(*) FILTER (WHERE type = 'pr') as pr_analyses,
          COUNT(*) FILTER (WHERE type = 'requirements') as requirements_analyses,
          COUNT(*) FILTER (WHERE status = 'completed') as completed,
          COUNT(*) FILTER (WHERE status = 'failed') as failed,
          COALESCE(AVG(scenarios_count), 0) as avg_scenarios,
          COALESCE(AVG(risks_count), 0) as avg_risks,
          COUNT(*) FILTER (WHERE overall_risk = 'critical') as critical_count,
          COUNT(*) FILTER (WHERE overall_risk = 'high') as high_count,
          COUNT(*) FILTER (WHERE was_helpful = true) as helpful_count,
          COUNT(*) FILTER (WHERE was_helpful = false) as not_helpful_count
        FROM analyses ${userFilter}`
      : 'SELECT * FROM v_statistics',
    params
  );

  if (!result) {
    return {
      totalAnalyses: 0,
      prAnalyses: 0,
      requirementsAnalyses: 0,
      completed: 0,
      failed: 0,
      avgScenarios: 0,
      avgRisks: 0,
      criticalCount: 0,
      highCount: 0,
      helpfulCount: 0,
      notHelpfulCount: 0,
    };
  }

  return {
    totalAnalyses: parseInt(result.total_analyses || '0', 10),
    prAnalyses: parseInt(result.pr_analyses || '0', 10),
    requirementsAnalyses: parseInt(result.requirements_analyses || '0', 10),
    completed: parseInt(result.completed || '0', 10),
    failed: parseInt(result.failed || '0', 10),
    avgScenarios: parseFloat(result.avg_scenarios || '0'),
    avgRisks: parseFloat(result.avg_risks || '0'),
    criticalCount: parseInt(result.critical_count || '0', 10),
    highCount: parseInt(result.high_count || '0', 10),
    helpfulCount: parseInt(result.helpful_count || '0', 10),
    notHelpfulCount: parseInt(result.not_helpful_count || '0', 10),
  };
}

// =============================================================================
// Feedback Operations
// =============================================================================

export async function updateAnalysisFeedback(
  analysisId: string,
  thumbsUp: number,
  thumbsDown: number
): Promise<void> {
  if (!isDatabaseEnabled()) return;

  await query(
    `UPDATE analyses 
     SET thumbs_up = thumbs_up + $2, 
         thumbs_down = thumbs_down + $3,
         was_helpful = CASE WHEN thumbs_up + $2 > thumbs_down + $3 THEN true ELSE false END
     WHERE id = $1`,
    [analysisId, thumbsUp, thumbsDown]
  );
}

export async function markAnalysisFailed(
  analysisId: string,
  errorMessage: string
): Promise<void> {
  if (!isDatabaseEnabled()) return;

  await query(
    `UPDATE analyses SET status = 'failed', error_message = $2, completed_at = NOW() WHERE id = $1`,
    [analysisId, errorMessage]
  );
}

// =============================================================================
// Async Analysis Operations
// =============================================================================

/**
 * Creates a pending analysis record for async processing
 * Returns the analysis ID immediately so the user can track progress
 */
export async function createPendingRequirementsAnalysis(
  input: {
    projectName?: string;
    featureName?: string;
    sprint?: string;
  },
  inputData?: Record<string, unknown>,
  userId?: string,
  projectId?: string,
  organizationId?: string
): Promise<string> {
  if (!isDatabaseEnabled()) {
    throw new Error('Database required for async analysis');
  }

  const result = await queryOne<{ id: string }>(
    `INSERT INTO analyses (
      type, status, version,
      project_name, feature_name, sprint,
      input_data, user_id, project_id, organization_id,
      scenarios_count, risks_count, gaps_count, criteria_count
    ) VALUES (
      'requirements', 'pending', '1.0.0',
      $1, $2, $3,
      $4, $5, $6, $7,
      0, 0, 0, 0
    ) RETURNING id`,
    [
      input.projectName,
      input.featureName,
      input.sprint,
      inputData ? JSON.stringify(inputData) : null,
      userId || null,
      projectId || null,
      organizationId || null,
    ]
  );

  return result?.id || '';
}

/**
 * Updates an analysis record to 'processing' status
 */
export async function markAnalysisProcessing(analysisId: string): Promise<void> {
  if (!isDatabaseEnabled()) return;

  await query(
    `UPDATE analyses SET status = 'processing' WHERE id = $1`,
    [analysisId]
  );
}

/**
 * Completes an async requirements analysis with results
 */
export async function completeRequirementsAnalysis(
  analysisId: string,
  analysis: RequirementsAnalysisResult
): Promise<void> {
  if (!isDatabaseEnabled()) return;

  await withTransaction(async (client: PoolClient) => {
    // Update main analysis record
    await client.query(
      `UPDATE analyses SET
        status = 'completed',
        overall_risk = $2,
        summary_title = $3,
        summary_description = $4,
        complexity = $5,
        scenarios_count = $6,
        risks_count = $7,
        gaps_count = $8,
        criteria_count = $9,
        result_data = $10,
        completed_at = NOW()
      WHERE id = $1`,
      [
        analysisId,
        analysis.risks?.[0]?.severity || 'medium',
        analysis.summary?.title || 'Requirements Analysis',
        analysis.summary?.description || '',
        analysis.summary?.complexity || 'medium',
        analysis.scenarios?.length || 0,
        analysis.risks?.length || 0,
        analysis.gaps?.length || 0,
        analysis.acceptanceCriteria?.length || 0,
        JSON.stringify(analysis),
      ]
    );

    // Save scenarios
    if (analysis.scenarios?.length) {
      for (const scenario of analysis.scenarios) {
        await client.query(
          `INSERT INTO test_scenarios (
            analysis_id, scenario_id, title, category, priority,
            preconditions, steps, expected_result, 
            suggested_test_type, effort, test_data, dependencies, heuristic
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)`,
          [
            analysisId,
            scenario.id,
            scenario.title,
            scenario.category,
            scenario.priority,
            scenario.preconditions || [],
            scenario.steps || [],
            scenario.expectedResult,
            scenario.suggestedTestType,
            scenario.effort,
            scenario.testData || [],
            scenario.dependencies || [],
            scenario.heuristic,
          ]
        );
      }
    }

    // Save acceptance criteria
    if (analysis.acceptanceCriteria?.length) {
      for (const ac of analysis.acceptanceCriteria) {
        await client.query(
          `INSERT INTO acceptance_criteria (
            analysis_id, criteria_id, description, criteria_type,
            gherkin_given, gherkin_when, gherkin_then, automatable
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
          [
            analysisId,
            ac.id,
            ac.description,
            ac.type,
            ac.gherkin?.given,
            ac.gherkin?.when,
            ac.gherkin?.then,
            ac.automatable,
          ]
        );
      }
    }

    // Save risks
    if (analysis.risks?.length) {
      for (const risk of analysis.risks) {
        await client.query(
          `INSERT INTO risks (
            analysis_id, title, area, description, severity, mitigation, affected_areas
          ) VALUES ($1, $2, $3, $4, $5, $6, $7)`,
          [
            analysisId,
            risk.title,
            null,
            risk.description,
            risk.severity,
            risk.mitigation,
            risk.affectedAreas || [],
          ]
        );
      }
    }

    // Save gaps
    if (analysis.gaps?.length) {
      for (const gap of analysis.gaps) {
        await client.query(
          `INSERT INTO gaps (
            analysis_id, title, description, gap_type, question, severity, recommendation
          ) VALUES ($1, $2, $3, $4, $5, $6, $7)`,
          [
            analysisId,
            gap.title,
            gap.description,
            gap.type,
            gap.question,
            gap.severity,
            null,
          ]
        );
      }
    }

    logger.info({ analysisId }, 'Requirements analysis completed and saved');
  });
}

