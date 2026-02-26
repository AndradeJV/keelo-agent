import { logger } from '../config/index.js';
import { createOctokitForInstallation } from '../integrations/github/client.js';
import type { PullRequestContext, RiskLevel } from './types.js';

// =============================================================================
// Types
// =============================================================================

export interface DependencyAnalysisResult {
  hasChanges: boolean;
  packageManager: 'npm' | 'yarn' | 'pnpm' | 'pip' | 'go' | 'cargo' | 'unknown';
  changes: DependencyChange[];
  risks: DependencyRisk[];
  summary: DependencySummary;
}

export interface DependencyChange {
  name: string;
  type: 'added' | 'removed' | 'upgraded' | 'downgraded' | 'changed';
  oldVersion?: string;
  newVersion?: string;
  category: 'production' | 'development' | 'peer' | 'optional';
  isCritical: boolean;
  reason?: string;
}

export interface DependencyRisk {
  level: RiskLevel;
  title: string;
  description: string;
  affectedPackages: string[];
  recommendation: string;
}

export interface DependencySummary {
  added: number;
  removed: number;
  upgraded: number;
  downgraded: number;
  criticalChanges: number;
}

// =============================================================================
// Critical Packages List
// =============================================================================

const CRITICAL_PACKAGES: Record<string, { reason: string; level: RiskLevel }> = {
  // Authentication & Security
  'jsonwebtoken': { reason: 'Autenticação JWT', level: 'high' },
  'bcrypt': { reason: 'Hash de senhas', level: 'critical' },
  'bcryptjs': { reason: 'Hash de senhas', level: 'critical' },
  'passport': { reason: 'Autenticação', level: 'high' },
  'passport-jwt': { reason: 'Autenticação JWT', level: 'high' },
  'express-session': { reason: 'Sessões', level: 'high' },
  'helmet': { reason: 'Segurança HTTP', level: 'medium' },
  'cors': { reason: 'CORS', level: 'medium' },
  'crypto-js': { reason: 'Criptografia', level: 'critical' },
  'node-forge': { reason: 'Criptografia', level: 'critical' },
  
  // Payments
  'stripe': { reason: 'Pagamentos Stripe', level: 'critical' },
  'paypal': { reason: 'Pagamentos PayPal', level: 'critical' },
  '@stripe/stripe-js': { reason: 'Pagamentos Stripe', level: 'critical' },
  'braintree': { reason: 'Pagamentos Braintree', level: 'critical' },
  
  // Database
  'pg': { reason: 'PostgreSQL', level: 'high' },
  'mysql2': { reason: 'MySQL', level: 'high' },
  'mongoose': { reason: 'MongoDB', level: 'high' },
  'prisma': { reason: 'ORM Prisma', level: 'high' },
  '@prisma/client': { reason: 'ORM Prisma', level: 'high' },
  'typeorm': { reason: 'ORM TypeORM', level: 'high' },
  'sequelize': { reason: 'ORM Sequelize', level: 'high' },
  'knex': { reason: 'Query Builder', level: 'medium' },
  
  // Core Framework
  'express': { reason: 'Framework Web', level: 'high' },
  'fastify': { reason: 'Framework Web', level: 'high' },
  'next': { reason: 'Framework Next.js', level: 'high' },
  'react': { reason: 'UI React', level: 'medium' },
  'react-dom': { reason: 'UI React DOM', level: 'medium' },
  'vue': { reason: 'UI Vue', level: 'medium' },
  
  // Validation
  'zod': { reason: 'Validação de Schema', level: 'medium' },
  'joi': { reason: 'Validação de Schema', level: 'medium' },
  'yup': { reason: 'Validação de Schema', level: 'medium' },
  
  // HTTP Client
  'axios': { reason: 'HTTP Client', level: 'medium' },
  'node-fetch': { reason: 'HTTP Client', level: 'medium' },
  
  // Queue & Jobs
  'bull': { reason: 'Filas de Jobs', level: 'high' },
  'bullmq': { reason: 'Filas de Jobs', level: 'high' },
  'agenda': { reason: 'Agendamento', level: 'medium' },
};

// Patterns for breaking changes
const BREAKING_VERSION_PATTERNS = [
  /^0\.\d+\.\d+ -> [1-9]\d*\./, // 0.x.x to 1.x.x or higher
  /^(\d+)\.\d+\.\d+ -> (\d+)\./, // Major version bump
];

// =============================================================================
// Dependency File Detection
// =============================================================================

interface DependencyFile {
  path: string;
  manager: 'npm' | 'yarn' | 'pnpm' | 'pip' | 'go' | 'cargo';
}

const DEPENDENCY_FILES: DependencyFile[] = [
  { path: 'package.json', manager: 'npm' },
  { path: 'package-lock.json', manager: 'npm' },
  { path: 'yarn.lock', manager: 'yarn' },
  { path: 'pnpm-lock.yaml', manager: 'pnpm' },
  { path: 'requirements.txt', manager: 'pip' },
  { path: 'Pipfile', manager: 'pip' },
  { path: 'Pipfile.lock', manager: 'pip' },
  { path: 'go.mod', manager: 'go' },
  { path: 'go.sum', manager: 'go' },
  { path: 'Cargo.toml', manager: 'cargo' },
  { path: 'Cargo.lock', manager: 'cargo' },
];

// =============================================================================
// Main Analysis Function
// =============================================================================

export async function analyzeDependencies(
  context: PullRequestContext,
  changedFiles: string[],
  diff: string
): Promise<DependencyAnalysisResult> {
  // Check if any dependency file was changed
  const dependencyFileChanges = changedFiles.filter(f => 
    DEPENDENCY_FILES.some(df => f.endsWith(df.path))
  );

  if (dependencyFileChanges.length === 0) {
    return {
      hasChanges: false,
      packageManager: 'unknown',
      changes: [],
      risks: [],
      summary: { added: 0, removed: 0, upgraded: 0, downgraded: 0, criticalChanges: 0 },
    };
  }

  // Detect package manager
  const packageManager = detectPackageManager(dependencyFileChanges);
  
  // Parse changes from diff
  const changes = parseDependencyChanges(diff, packageManager);
  
  // Identify risks
  const risks = identifyDependencyRisks(changes);
  
  // Build summary
  const summary: DependencySummary = {
    added: changes.filter(c => c.type === 'added').length,
    removed: changes.filter(c => c.type === 'removed').length,
    upgraded: changes.filter(c => c.type === 'upgraded').length,
    downgraded: changes.filter(c => c.type === 'downgraded').length,
    criticalChanges: changes.filter(c => c.isCritical).length,
  };

  logger.info({
    packageManager,
    changesCount: changes.length,
    risksCount: risks.length,
    criticalCount: summary.criticalChanges,
  }, 'Dependency analysis completed');

  return {
    hasChanges: true,
    packageManager,
    changes,
    risks,
    summary,
  };
}

function detectPackageManager(files: string[]): DependencyAnalysisResult['packageManager'] {
  for (const file of files) {
    const match = DEPENDENCY_FILES.find(df => file.endsWith(df.path));
    if (match) return match.manager;
  }
  return 'unknown';
}

// =============================================================================
// Diff Parsing
// =============================================================================

function parseDependencyChanges(
  diff: string,
  packageManager: string
): DependencyChange[] {
  const changes: DependencyChange[] = [];

  // Extract package.json specific section from diff
  const packageJsonMatch = diff.match(/diff --git a\/package\.json[\s\S]*?(?=diff --git|$)/);
  
  if (packageJsonMatch) {
    const packageDiff = packageJsonMatch[0];
    
    // Find added dependencies
    const addedMatches = packageDiff.matchAll(/^\+\s*"([^"]+)":\s*"([^"]+)"/gm);
    for (const match of addedMatches) {
      const [, name, version] = match;
      if (name && !name.startsWith('@types/')) {
        // Check if it was also removed (meaning it's a version change)
        const wasRemoved = new RegExp(`^-\\s*"${name}":\\s*"([^"]+)"`, 'm').exec(packageDiff);
        
        if (wasRemoved) {
          const oldVersion = wasRemoved[1];
          const changeType = determineVersionChange(oldVersion, version);
          changes.push({
            name,
            type: changeType,
            oldVersion,
            newVersion: version,
            category: getCategoryFromDiff(packageDiff, name),
            isCritical: isCriticalPackage(name),
            reason: getCriticalReason(name),
          });
        } else {
          changes.push({
            name,
            type: 'added',
            newVersion: version,
            category: getCategoryFromDiff(packageDiff, name),
            isCritical: isCriticalPackage(name),
            reason: getCriticalReason(name),
          });
        }
      }
    }

    // Find removed dependencies (that weren't upgraded)
    const removedMatches = packageDiff.matchAll(/^-\s*"([^"]+)":\s*"([^"]+)"/gm);
    for (const match of removedMatches) {
      const [, name, version] = match;
      if (name && !name.startsWith('@types/')) {
        const wasAdded = changes.some(c => c.name === name);
        if (!wasAdded) {
          changes.push({
            name,
            type: 'removed',
            oldVersion: version,
            category: getCategoryFromDiff(packageDiff, name),
            isCritical: isCriticalPackage(name),
            reason: getCriticalReason(name),
          });
        }
      }
    }
  }

  return changes;
}

function determineVersionChange(oldVersion: string, newVersion: string): 'upgraded' | 'downgraded' | 'changed' {
  // Clean version strings
  const cleanOld = oldVersion.replace(/[\^~>=<]/g, '');
  const cleanNew = newVersion.replace(/[\^~>=<]/g, '');

  const oldParts = cleanOld.split('.').map(Number);
  const newParts = cleanNew.split('.').map(Number);

  for (let i = 0; i < Math.max(oldParts.length, newParts.length); i++) {
    const oldPart = oldParts[i] || 0;
    const newPart = newParts[i] || 0;
    
    if (newPart > oldPart) return 'upgraded';
    if (newPart < oldPart) return 'downgraded';
  }

  return 'changed';
}

function getCategoryFromDiff(diff: string, packageName: string): DependencyChange['category'] {
  // Check which section the package appears in
  const devDepsMatch = diff.match(/"devDependencies"[\s\S]*?"dependencies"/);
  if (devDepsMatch && devDepsMatch[0].includes(`"${packageName}"`)) {
    return 'development';
  }
  
  const peerDepsMatch = diff.match(/"peerDependencies"[\s\S]*?}/);
  if (peerDepsMatch && peerDepsMatch[0].includes(`"${packageName}"`)) {
    return 'peer';
  }

  return 'production';
}

function isCriticalPackage(name: string): boolean {
  return name in CRITICAL_PACKAGES;
}

function getCriticalReason(name: string): string | undefined {
  return CRITICAL_PACKAGES[name]?.reason;
}

// =============================================================================
// Risk Identification
// =============================================================================

function identifyDependencyRisks(changes: DependencyChange[]): DependencyRisk[] {
  const risks: DependencyRisk[] = [];

  // Critical package changes
  const criticalChanges = changes.filter(c => c.isCritical);
  if (criticalChanges.length > 0) {
    for (const change of criticalChanges) {
      const level = CRITICAL_PACKAGES[change.name]?.level || 'high';
      
      risks.push({
        level,
        title: `Mudança em pacote crítico: ${change.name}`,
        description: `${change.reason || 'Pacote sensível'} - ${change.type === 'added' ? 'adicionado' : change.type === 'removed' ? 'removido' : `atualizado de ${change.oldVersion} para ${change.newVersion}`}`,
        affectedPackages: [change.name],
        recommendation: level === 'critical' 
          ? 'Requer revisão detalhada e testes de regressão'
          : 'Verifique changelog e teste funcionalidades dependentes',
      });
    }
  }

  // Major version bumps (potential breaking changes)
  const majorBumps = changes.filter(c => 
    c.type === 'upgraded' && 
    c.oldVersion && 
    c.newVersion &&
    isMajorVersionBump(c.oldVersion, c.newVersion)
  );

  if (majorBumps.length > 0) {
    risks.push({
      level: 'high',
      title: 'Breaking changes potenciais',
      description: `${majorBumps.length} pacote(s) com bump de versão major - possíveis breaking changes`,
      affectedPackages: majorBumps.map(c => c.name),
      recommendation: 'Verifique changelogs para breaking changes e atualize código conforme necessário',
    });
  }

  // Removed packages
  const removed = changes.filter(c => c.type === 'removed' && c.category === 'production');
  if (removed.length > 0) {
    risks.push({
      level: 'medium',
      title: 'Pacotes de produção removidos',
      description: `${removed.length} dependência(s) de produção removida(s)`,
      affectedPackages: removed.map(c => c.name),
      recommendation: 'Verifique se todas as referências foram removidas e não há código órfão',
    });
  }

  // Many new dependencies
  const added = changes.filter(c => c.type === 'added');
  if (added.length > 5) {
    risks.push({
      level: 'medium',
      title: 'Muitas dependências adicionadas',
      description: `${added.length} novas dependências - aumento do tamanho do bundle e superfície de ataque`,
      affectedPackages: added.map(c => c.name),
      recommendation: 'Revise se todas são necessárias e considere alternativas mais leves',
    });
  }

  // Downgraded packages
  const downgraded = changes.filter(c => c.type === 'downgraded');
  if (downgraded.length > 0) {
    risks.push({
      level: 'medium',
      title: 'Downgrade de versão',
      description: `${downgraded.length} pacote(s) com versão reduzida`,
      affectedPackages: downgraded.map(c => c.name),
      recommendation: 'Verifique o motivo do downgrade - pode haver vulnerabilidades ou incompatibilidades',
    });
  }

  return risks;
}

function isMajorVersionBump(oldVersion: string, newVersion: string): boolean {
  const cleanOld = oldVersion.replace(/[\^~>=<]/g, '');
  const cleanNew = newVersion.replace(/[\^~>=<]/g, '');

  const oldMajor = parseInt(cleanOld.split('.')[0], 10);
  const newMajor = parseInt(cleanNew.split('.')[0], 10);

  return !isNaN(oldMajor) && !isNaN(newMajor) && newMajor > oldMajor;
}

// =============================================================================
// Formatting
// =============================================================================

export function formatDependencySection(result: DependencyAnalysisResult): string {
  if (!result.hasChanges) {
    return '';
  }

  const lines: string[] = ['### 📦 Análise de Dependências', ''];

  // Summary
  const { summary } = result;
  const parts: string[] = [];
  if (summary.added > 0) parts.push(`+${summary.added} adicionadas`);
  if (summary.removed > 0) parts.push(`-${summary.removed} removidas`);
  if (summary.upgraded > 0) parts.push(`↑${summary.upgraded} atualizadas`);
  if (summary.downgraded > 0) parts.push(`↓${summary.downgraded} downgraded`);
  
  lines.push(`> **Package Manager:** ${result.packageManager} | ${parts.join(' | ')}`);
  lines.push('');

  // Critical changes warning
  if (summary.criticalChanges > 0) {
    lines.push(`⚠️ **${summary.criticalChanges} mudança(s) em pacotes críticos**`);
    lines.push('');
  }

  // Risks
  if (result.risks.length > 0) {
    lines.push('#### 🚨 Riscos Identificados');
    lines.push('');
    
    for (const risk of result.risks) {
      const emoji = risk.level === 'critical' ? '🔴' : risk.level === 'high' ? '🟠' : '🟡';
      lines.push(`<details>`);
      lines.push(`<summary>${emoji} <b>${risk.title}</b></summary>`);
      lines.push('');
      lines.push(risk.description);
      lines.push('');
      lines.push(`**Pacotes:** ${risk.affectedPackages.map(p => `\`${p}\``).join(', ')}`);
      lines.push('');
      lines.push(`**Recomendação:** ${risk.recommendation}`);
      lines.push('');
      lines.push('</details>');
      lines.push('');
    }
  }

  // Changes table
  if (result.changes.length > 0 && result.changes.length <= 20) {
    lines.push('<details>');
    lines.push('<summary>📋 Detalhes das mudanças</summary>');
    lines.push('');
    lines.push('| Pacote | Tipo | Versão | Categoria |');
    lines.push('|--------|------|--------|-----------|');
    
    for (const change of result.changes) {
      const typeEmoji = change.type === 'added' ? '➕' :
                        change.type === 'removed' ? '➖' :
                        change.type === 'upgraded' ? '⬆️' :
                        change.type === 'downgraded' ? '⬇️' : '🔄';
      
      const version = change.oldVersion && change.newVersion 
        ? `${change.oldVersion} → ${change.newVersion}`
        : change.newVersion || change.oldVersion || '-';
      
      const critical = change.isCritical ? ' ⚠️' : '';
      
      lines.push(`| \`${change.name}\`${critical} | ${typeEmoji} ${change.type} | ${version} | ${change.category} |`);
    }
    lines.push('');
    lines.push('</details>');
    lines.push('');
  }

  return lines.join('\n');
}

