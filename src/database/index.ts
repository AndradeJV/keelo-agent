/**
 * Database Module
 * 
 * PostgreSQL integration for storing analysis history
 */

export {
  initDatabase,
  getPool,
  isDatabaseEnabled,
  query,
  queryOne,
  queryAll,
  getClient,
  withTransaction,
  closeDatabase,
  checkDatabaseHealth,
} from './connection.js';

export {
  findOrCreateRepository,
  getRepositories,
  createRepository,
  deleteRepository,
  getRepositoryById,
  createPRAnalysis,
  createRequirementsAnalysis,
  createPendingRequirementsAnalysis,
  markAnalysisProcessing,
  completeRequirementsAnalysis,
  getAnalysisById,
  getAnalyses,
  getAnalysisSummary,
  getPRAnalysisHistory,
  getStatistics,
  updateAnalysisFeedback,
  markAnalysisFailed,
  type AnalysisRecord,
  type RepositoryRecord,
  type RepositoryWithStats,
  type AnalysisFilter,
  type TriggerSource,
} from './repositories/analysis-repository.js';

export {
  recordRiskHotspot,
  recordRisksFromAnalysis,
  getHotspots,
  getHotspotsByArea,
  getHotspotSummary,
  formatHotspotsSection,
  type RiskHotspot,
  type HotspotSummary,
} from './repositories/hotspots-repository.js';

export {
  getQAHealthMetrics,
  getAreaCoverage,
  getFlakyTests,
  getTestEffectiveness,
  type QAHealthMetrics,
  type AreaCoverage,
} from './repositories/qa-metrics-repository.js';

export {
  getSettings,
  updateSettings,
  patchSettings,
  resetSettings,
  getSettingsMetadata,
  DEFAULT_CONFIG_DB,
  type KeeloConfigDB,
} from './repositories/settings-repository.js';

export {
  findUserByGoogleId,
  findUserByEmail,
  findUserById,
  findUserByUsername,
  findUserByGithubId,
  verifyPassword,
  createUserWithPassword,
  upsertUser,
  upsertGithubUser,
  registerUserWithEmail,
  confirmUserEmail,
  regenerateVerificationToken,
  seedAdminUser,
  type UserRecord,
} from './repositories/user-repository.js';

export {
  createOrganization,
  getOrganizationById,
  getOrganizationBySlug,
  getUserOrganizations,
  updateOrganization,
  deleteOrganization,
  getOrgMembership,
  getOrgMembers,
  addOrgMember,
  removeOrgMember,
  userHasOrgAccess,
  type OrganizationRecord,
  type OrgMemberRecord,
  type OrganizationWithRole,
} from './repositories/organization-repository.js';

export {
  createProject,
  getProjectById,
  getOrgProjects,
  getProjectBySlug,
  updateProject,
  deleteProject,
  userHasProjectAccess,
  getUserProjects,
  type ProjectRecord,
  type ProjectWithStats,
} from './repositories/project-repository.js';

export { runMigrations } from './migrator.js';

export {
  classifyBugOrigin,
  upsertJiraBugEvents,
  getWeeklyJiraBugStats,
  hasWeeklyReportBeenSent,
  markWeeklyReportSent,
  type JiraBugEvent,
  type WeeklyJiraBugStats,
  type BugOrigin,
} from './repositories/jira-metrics-repository.js';
