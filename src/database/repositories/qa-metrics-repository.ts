import { query, queryOne, queryAll, isDatabaseEnabled } from '../connection.js';
import { logger } from '../../config/index.js';

// =============================================================================
// Types
// =============================================================================

export interface QAHealthMetrics {
  period: 'daily' | 'weekly' | 'monthly';
  dateRange: {
    start: string;
    end: string;
  };
  
  // Analysis metrics
  totalPRsAnalyzed: number;
  requirementsAnalyzed: number;
  testsGenerated: number;
  testPRsCreated: number;
  
  // Risk metrics
  risks: {
    critical: number;
    high: number;
    medium: number;
    low: number;
    total: number;
  };
  
  // Coverage metrics
  coverage: {
    average: number;
    improved: number;
    decreased: number;
    unchanged: number;
  };
  
  // Scenario metrics
  scenarios: {
    total: number;
    byType: Record<string, number>;
  };
  
  // Gap metrics
  gaps: {
    total: number;
    resolved: number;
    pending: number;
  };
  
  // Hot spots
  hotSpots: Array<{
    area: string;
    file_path: string;
    riskCount: number;
    lastRisk: string;
    lastRiskLevel: string;
  }>;
  
  // PR without tests
  prsWithoutTests: Array<{
    id: string;
    pr_number: number;
    pr_title: string;
    repository: string;
    created_at: string;
  }>;
  
  // Trend data (for charts)
  trends: {
    dates: string[];
    analysesCount: number[];
    risksCount: number[];
    testsGenerated: number[];
  };
}

export interface AreaCoverage {
  area: string;
  filesCount: number;
  testsCount: number;
  risksCount: number;
  coverageEstimate: number; // 0-100
  lastAnalysis: string;
}

// =============================================================================
// QA Metrics Functions
// =============================================================================

export async function getQAHealthMetrics(
  period: 'daily' | 'weekly' | 'monthly' = 'weekly',
  repositoryId?: string
): Promise<QAHealthMetrics | null> {
  if (!isDatabaseEnabled()) {
    return null;
  }

  try {
    // Calculate date range
    const now = new Date();
    let startDate: Date;
    
    switch (period) {
      case 'daily':
        startDate = new Date(now);
        startDate.setDate(startDate.getDate() - 1);
        break;
      case 'weekly':
        startDate = new Date(now);
        startDate.setDate(startDate.getDate() - 7);
        break;
      case 'monthly':
        startDate = new Date(now);
        startDate.setMonth(startDate.getMonth() - 1);
        break;
    }

    const dateFilter = repositoryId 
      ? 'AND a.repository_id = $2'
      : '';
    const params = repositoryId 
      ? [startDate.toISOString(), repositoryId]
      : [startDate.toISOString()];

    // Get analysis counts
    const analysisCounts = await queryOne<{
      total_pr: string;
      total_requirements: string;
    }>(`
      SELECT 
        COUNT(*) FILTER (WHERE type = 'pr') as total_pr,
        COUNT(*) FILTER (WHERE type = 'requirements') as total_requirements
      FROM analyses a
      WHERE a.created_at >= $1 ${dateFilter}
    `, params);

    // Get risk counts
    const riskCounts = await queryOne<{
      critical: string;
      high: string;
      medium: string;
      low: string;
    }>(`
      SELECT 
        COUNT(*) FILTER (WHERE r.severity = 'critical') as critical,
        COUNT(*) FILTER (WHERE r.severity = 'high') as high,
        COUNT(*) FILTER (WHERE r.severity = 'medium') as medium,
        COUNT(*) FILTER (WHERE r.severity = 'low') as low
      FROM risks r
      JOIN analyses a ON r.analysis_id = a.id
      WHERE a.created_at >= $1 ${dateFilter}
    `, params);

    // Get scenario counts
    const scenarioCounts = await queryOne<{
      total: string;
    }>(`
      SELECT COUNT(*) as total
      FROM test_scenarios ts
      JOIN analyses a ON ts.analysis_id = a.id
      WHERE a.created_at >= $1 ${dateFilter}
    `, params);

    // Get gap counts
    const gapCounts = await queryOne<{
      total: string;
    }>(`
      SELECT COUNT(*) as total
      FROM gaps g
      JOIN analyses a ON g.analysis_id = a.id
      WHERE a.created_at >= $1 ${dateFilter}
    `, params);

    // Get hot spots (handle table not existing)
    let hotSpots: {
      area_name: string;
      file_path: string;
      total_risks: number;
      last_risk_title: string;
      last_risk_level: string;
    }[] = [];
    
    try {
      hotSpots = await queryAll<{
        area_name: string;
        file_path: string;
        total_risks: number;
        last_risk_title: string;
        last_risk_level: string;
      }>(`
        SELECT 
          area_name,
          file_path,
          total_risks,
          last_risk_title,
          last_risk_level
        FROM risk_hotspots
        ${repositoryId ? 'WHERE repository_id = $1' : ''}
        ORDER BY total_risks DESC
        LIMIT 10
      `, repositoryId ? [repositoryId] : []);
    } catch (hotspotError) {
      // Table might not exist yet, return empty array
      logger.debug({ error: hotspotError }, 'risk_hotspots table may not exist yet');
    }

    // Get PRs without tests (no test scenarios)
    const prsWithoutTests = await queryAll<{
      id: string;
      pr_number: number;
      pr_title: string;
      repository: string;
      created_at: string;
    }>(`
      SELECT 
        a.id,
        a.pr_number,
        a.pr_title,
        COALESCE(r.owner || '/' || r.name, 'unknown') as repository,
        a.created_at
      FROM analyses a
      LEFT JOIN repositories r ON a.repository_id = r.id
      WHERE a.type = 'pr'
        AND a.created_at >= $1
        AND a.scenarios_count = 0
        ${dateFilter}
      ORDER BY a.created_at DESC
      LIMIT 10
    `, params);

    // Get trend data (daily counts for the period)
    const trends = await queryAll<{
      date: string;
      analyses: string;
      risks: string;
      tests: string;
    }>(`
      SELECT 
        DATE(a.created_at) as date,
        COUNT(DISTINCT a.id) as analyses,
        COUNT(DISTINCT r.id) as risks,
        COUNT(DISTINCT ts.id) as tests
      FROM analyses a
      LEFT JOIN risks r ON r.analysis_id = a.id
      LEFT JOIN test_scenarios ts ON ts.analysis_id = a.id
      WHERE a.created_at >= $1 ${dateFilter}
      GROUP BY DATE(a.created_at)
      ORDER BY date
    `, params);

    // Calculate test generation estimate (based on playwright suggestions)
    const testGenCount = await queryOne<{ count: string }>(`
      SELECT COUNT(*) as count
      FROM playwright_suggestions ps
      JOIN analyses a ON ps.analysis_id = a.id
      WHERE a.created_at >= $1 ${dateFilter}
    `, params);

    const totalRisks = (parseInt(riskCounts?.critical || '0') +
                       parseInt(riskCounts?.high || '0') +
                       parseInt(riskCounts?.medium || '0') +
                       parseInt(riskCounts?.low || '0'));

    return {
      period,
      dateRange: {
        start: startDate.toISOString().split('T')[0],
        end: now.toISOString().split('T')[0],
      },
      totalPRsAnalyzed: parseInt(analysisCounts?.total_pr || '0'),
      requirementsAnalyzed: parseInt(analysisCounts?.total_requirements || '0'),
      testsGenerated: parseInt(testGenCount?.count || '0'),
      testPRsCreated: 0, // TODO: Track this when implementing test PR tracking
      
      risks: {
        critical: parseInt(riskCounts?.critical || '0'),
        high: parseInt(riskCounts?.high || '0'),
        medium: parseInt(riskCounts?.medium || '0'),
        low: parseInt(riskCounts?.low || '0'),
        total: totalRisks,
      },
      
      coverage: {
        average: 0, // TODO: Calculate from actual coverage data
        improved: 0,
        decreased: 0,
        unchanged: 0,
      },
      
      scenarios: {
        total: parseInt(scenarioCounts?.total || '0'),
        byType: {},
      },
      
      gaps: {
        total: parseInt(gapCounts?.total || '0'),
        resolved: 0,
        pending: parseInt(gapCounts?.total || '0'),
      },
      
      hotSpots: hotSpots.map(h => ({
        area: h.area_name,
        file_path: h.file_path,
        riskCount: h.total_risks,
        lastRisk: h.last_risk_title || '',
        lastRiskLevel: h.last_risk_level || 'medium',
      })),
      
      prsWithoutTests: prsWithoutTests.map(p => ({
        id: p.id,
        pr_number: p.pr_number,
        pr_title: p.pr_title,
        repository: p.repository,
        created_at: p.created_at,
      })),
      
      trends: {
        dates: trends.map(t => t.date),
        analysesCount: trends.map(t => parseInt(t.analyses)),
        risksCount: trends.map(t => parseInt(t.risks)),
        testsGenerated: trends.map(t => parseInt(t.tests)),
      },
    };
  } catch (error) {
    logger.error({ error }, 'Failed to get QA health metrics');
    return null;
  }
}

export async function getAreaCoverage(): Promise<AreaCoverage[]> {
  if (!isDatabaseEnabled()) {
    return [];
  }

  try {
    let areas: {
      area_name: string;
      files_count: string;
      total_risks: string;
      last_updated: string;
    }[] = [];
    
    try {
      areas = await queryAll<{
        area_name: string;
        files_count: string;
        total_risks: string;
        last_updated: string;
      }>(`
        SELECT 
          area_name,
          COUNT(DISTINCT file_path) as files_count,
          SUM(total_risks) as total_risks,
          MAX(updated_at) as last_updated
        FROM risk_hotspots
        GROUP BY area_name
        ORDER BY total_risks DESC
      `, []);
    } catch (tableError) {
      // Table might not exist yet
      logger.debug({ error: tableError }, 'risk_hotspots table may not exist yet');
      return [];
    }

    // Get test scenarios by area (estimated from category)
    const scenariosByArea = await queryAll<{
      category: string;
      count: string;
    }>(`
      SELECT 
        category,
        COUNT(*) as count
      FROM test_scenarios
      GROUP BY category
    `, []);

    const scenarioMap: Record<string, number> = {};
    for (const s of scenariosByArea) {
      scenarioMap[s.category.toLowerCase()] = parseInt(s.count);
    }

    return areas.map(area => {
      const filesCount = parseInt(area.files_count);
      const risksCount = parseInt(area.total_risks);
      const testsCount = scenarioMap[area.area_name.toLowerCase()] || 0;
      
      // Estimate coverage based on tests vs risks ratio
      const coverageEstimate = risksCount > 0 
        ? Math.min(100, Math.round((testsCount / risksCount) * 50))
        : testsCount > 0 ? 80 : 0;

      return {
        area: area.area_name,
        filesCount,
        testsCount,
        risksCount,
        coverageEstimate,
        lastAnalysis: area.last_updated,
      };
    });
  } catch (error) {
    logger.error({ error }, 'Failed to get area coverage');
    return [];
  }
}

export async function getFlakyTests(): Promise<Array<{
  file: string;
  name: string;
  failureRate: number;
  lastFailure: string;
}>> {
  // TODO: Implement when we have test execution tracking
  // For now, return empty array
  return [];
}

export async function getTestEffectiveness(): Promise<{
  bugsPreventedEstimate: number;
  risksMitigated: number;
  coverageImprovement: number;
}> {
  if (!isDatabaseEnabled()) {
    return {
      bugsPreventedEstimate: 0,
      risksMitigated: 0,
      coverageImprovement: 0,
    };
  }

  try {
    // Count risks that have test scenarios associated
    const mitigatedRisks = await queryOne<{ count: string }>(`
      SELECT COUNT(DISTINCT r.id) as count
      FROM risks r
      JOIN analyses a ON r.analysis_id = a.id
      WHERE a.scenarios_count > 0
    `, []);

    // Estimate bugs prevented (based on critical/high risks with tests)
    const criticalWithTests = await queryOne<{ count: string }>(`
      SELECT COUNT(*) as count
      FROM risks r
      JOIN analyses a ON r.analysis_id = a.id
      WHERE r.severity IN ('critical', 'high')
        AND a.scenarios_count > 0
    `, []);

    return {
      bugsPreventedEstimate: parseInt(criticalWithTests?.count || '0'),
      risksMitigated: parseInt(mitigatedRisks?.count || '0'),
      coverageImprovement: 0, // TODO: Calculate from actual data
    };
  } catch (error) {
    logger.error({ error }, 'Failed to get test effectiveness');
    return {
      bugsPreventedEstimate: 0,
      risksMitigated: 0,
      coverageImprovement: 0,
    };
  }
}

