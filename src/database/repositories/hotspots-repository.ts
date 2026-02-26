import { logger } from '../../config/index.js';
import { query, queryAll, isDatabaseEnabled } from '../connection.js';
import type { RiskLevel } from '../../core/types.js';

// =============================================================================
// Types
// =============================================================================

export interface RiskHotspot {
  id: string;
  repository: string;
  file_path: string;
  area_name: string;
  total_risks: number;
  critical_count: number;
  high_count: number;
  medium_count: number;
  low_count: number;
  last_risk_at: string;
  last_risk_level: RiskLevel;
  last_risk_title: string;
  pr_count: number;
  recurring_issues: string[];
  risk_score: number;
  updated_at: string;
}

export interface HotspotSummary {
  totalHotspots: number;
  criticalAreas: number;
  topAreas: { area: string; count: number }[];
  recentHotspots: RiskHotspot[];
}

// =============================================================================
// Save Risk to Hotspot
// =============================================================================

export async function recordRiskHotspot(
  repositoryId: string,
  filePath: string,
  riskLevel: RiskLevel,
  riskTitle: string,
  prNumber: number
): Promise<void> {
  if (!isDatabaseEnabled()) return;

  try {
    await query(
      'SELECT update_risk_hotspot($1, $2, $3, $4, $5)',
      [repositoryId, filePath, riskLevel, riskTitle, prNumber]
    );

    logger.debug({
      file: filePath,
      level: riskLevel,
      pr: prNumber,
    }, 'Risk hotspot recorded');
  } catch (error) {
    logger.error({ error }, 'Failed to record risk hotspot');
  }
}

export async function recordRisksFromAnalysis(
  repositoryId: string,
  prNumber: number,
  risks: Array<{ area?: string; level: RiskLevel; title: string }>,
  changedFiles: string[]
): Promise<void> {
  if (!isDatabaseEnabled() || risks.length === 0) return;

  try {
    for (const risk of risks) {
      // Try to match risk to a specific file
      const matchedFile = risk.area 
        ? changedFiles.find(f => f.toLowerCase().includes(risk.area?.toLowerCase() || ''))
        : changedFiles[0];
      
      const filePath = matchedFile || risk.area || 'unknown';
      
      await query(
        'SELECT update_risk_hotspot($1, $2, $3, $4, $5)',
        [repositoryId, filePath, risk.level, risk.title, prNumber]
      );
    }

    logger.info({
      risksCount: risks.length,
      prNumber,
    }, 'Recorded risks to hotspots');
  } catch (error) {
    logger.error({ error }, 'Failed to record risks to hotspots');
  }
}

// =============================================================================
// Query Hotspots
// =============================================================================

export async function getHotspots(
  repositoryFullName?: string,
  limit = 20
): Promise<RiskHotspot[]> {
  if (!isDatabaseEnabled()) return [];

  try {
    const sql = repositoryFullName
      ? `SELECT * FROM v_risk_hotspots WHERE repository = $1 ORDER BY risk_score DESC LIMIT $2`
      : `SELECT * FROM v_risk_hotspots ORDER BY risk_score DESC LIMIT $1`;
    
    const params = repositoryFullName 
      ? [repositoryFullName, limit]
      : [limit];

    return await queryAll<RiskHotspot>(sql, params);
  } catch (error) {
    logger.error({ error }, 'Failed to get hotspots');
    return [];
  }
}

export async function getHotspotsByArea(
  areaName: string,
  limit = 10
): Promise<RiskHotspot[]> {
  if (!isDatabaseEnabled()) return [];

  try {
    return await queryAll<RiskHotspot>(
      `SELECT * FROM v_risk_hotspots 
       WHERE area_name = $1 
       ORDER BY risk_score DESC 
       LIMIT $2`,
      [areaName, limit]
    );
  } catch (error) {
    logger.error({ error }, 'Failed to get hotspots by area');
    return [];
  }
}

export async function getHotspotSummary(
  repositoryFullName?: string
): Promise<HotspotSummary> {
  if (!isDatabaseEnabled()) {
    return {
      totalHotspots: 0,
      criticalAreas: 0,
      topAreas: [],
      recentHotspots: [],
    };
  }

  try {
    // Get total and critical count
    const statsQuery = repositoryFullName
      ? `SELECT 
           COUNT(*) as total,
           COUNT(*) FILTER (WHERE critical_count > 0) as critical
         FROM v_risk_hotspots WHERE repository = $1`
      : `SELECT 
           COUNT(*) as total,
           COUNT(*) FILTER (WHERE critical_count > 0) as critical
         FROM v_risk_hotspots`;
    
    const statsParams = repositoryFullName ? [repositoryFullName] : [];
    const statsResult = await queryAll<{ total: string; critical: string }>(statsQuery, statsParams);
    const stats = statsResult[0] || { total: '0', critical: '0' };

    // Get top areas
    const areasQuery = repositoryFullName
      ? `SELECT area_name as area, SUM(total_risks)::int as count
         FROM v_risk_hotspots WHERE repository = $1
         GROUP BY area_name ORDER BY count DESC LIMIT 5`
      : `SELECT area_name as area, SUM(total_risks)::int as count
         FROM v_risk_hotspots
         GROUP BY area_name ORDER BY count DESC LIMIT 5`;
    
    const areasResult = await queryAll<{ area: string; count: number }>(areasQuery, statsParams);

    // Get recent hotspots
    const recentHotspots = await getHotspots(repositoryFullName, 5);

    return {
      totalHotspots: parseInt(stats.total, 10),
      criticalAreas: parseInt(stats.critical, 10),
      topAreas: areasResult,
      recentHotspots,
    };
  } catch (error) {
    logger.error({ error }, 'Failed to get hotspot summary');
    return {
      totalHotspots: 0,
      criticalAreas: 0,
      topAreas: [],
      recentHotspots: [],
    };
  }
}

// =============================================================================
// Formatting for Dashboard
// =============================================================================

export function formatHotspotsSection(hotspots: RiskHotspot[]): string {
  if (hotspots.length === 0) return '';

  const lines: string[] = ['### 🔥 Áreas de Risco (Hot Spots)', ''];

  lines.push('| Área | Arquivo | Riscos | Score |');
  lines.push('|------|---------|--------|-------|');

  for (const hs of hotspots.slice(0, 5)) {
    const levelEmoji = hs.last_risk_level === 'critical' ? '🔴' :
                       hs.last_risk_level === 'high' ? '🟠' :
                       hs.last_risk_level === 'medium' ? '🟡' : '🟢';
    
    const fileName = hs.file_path.split('/').pop() || hs.file_path;
    
    lines.push(`| ${levelEmoji} ${hs.area_name} | \`${fileName}\` | ${hs.total_risks} | ${hs.risk_score} |`);
  }

  lines.push('');
  lines.push('> Hot spots são áreas do código com riscos recorrentes');
  lines.push('');

  return lines.join('\n');
}

