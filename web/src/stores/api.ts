const API_BASE = import.meta.env.VITE_API_URL || '/api';

// =============================================================================
// Types
// =============================================================================

export interface AnalysisListResponse {
  success: boolean;
  data: Analysis[];
  pagination: {
    limit: number;
    offset: number;
    count: number;
  };
}

export type TriggerSource = 'auto' | 'command' | 'silent';

export interface Analysis {
  id: string;
  type: 'pr' | 'requirements' | 'figma' | 'user_story';
  status: 'pending' | 'processing' | 'completed' | 'failed';
  version?: string;
  trigger_source?: TriggerSource;
  repository_id?: string;
  repository?: string; // full_name from view (e.g. 'owner/repo')
  pr_number?: number;
  pr_title?: string;
  pr_url?: string;
  feature_name?: string;
  project_name?: string;
  sprint?: string;
  overall_risk?: 'critical' | 'high' | 'medium' | 'low';
  summary_title?: string;
  summary_description?: string;
  complexity?: string;
  scenarios_count: number;
  risks_count: number;
  gaps_count: number;
  criteria_count?: number;
  thumbs_up?: number;
  thumbs_down?: number;
  was_helpful?: boolean;
  created_at: string;
  completed_at?: string;
  error_message?: string;
}

export interface Stats {
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
}

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
  last_risk_level: 'critical' | 'high' | 'medium' | 'low';
  last_risk_title: string;
  pr_count: number;
  risk_score: number;
  updated_at: string;
}

export interface HotspotSummary {
  totalHotspots: number;
  criticalAreas: number;
  topAreas: { area: string; count: number }[];
  recentHotspots: RiskHotspot[];
}

export interface RequirementsInput {
  figmaUrl?: string;
  figmaImage?: string;
  requirements?: string;
  pdfBase64?: string;
  projectId?: string;
  organizationId?: string;
  metadata?: {
    projectName?: string;
    featureName?: string;
    sprint?: string;
    priority?: 'high' | 'medium' | 'low';
  };
  format?: 'json' | 'markdown';
}

export interface Repository {
  id: string;
  owner: string;
  name: string;
  full_name: string;
  installation_id?: number;
  analysis_count: number;
  last_analysis_at?: string;
}

// =============================================================================
// Organization & Project Types
// =============================================================================

export interface Organization {
  id: string;
  name: string;
  slug: string;
  avatar: string | null;
  owner_id: string;
  member_role: 'owner' | 'admin' | 'member';
  member_count?: number;
  project_count?: number;
  created_at: string;
  updated_at: string;
}

export interface OrgMember {
  id: string;
  organization_id: string;
  user_id: string;
  role: 'owner' | 'admin' | 'member';
  user_email?: string;
  user_name?: string;
  user_avatar?: string;
  joined_at: string;
}

export interface Project {
  id: string;
  organization_id: string;
  name: string;
  slug: string;
  description: string | null;
  created_by: string | null;
  analysis_count: number;
  last_analysis_at: string | null;
  created_at: string;
  updated_at: string;
}

// =============================================================================
// API Functions
// =============================================================================

async function fetchWithAuth(url: string, options: RequestInit = {}): Promise<Response> {
  const token = localStorage.getItem('keelo_token');
  
  const headers = {
    'Content-Type': 'application/json',
    ...(token && { Authorization: `Bearer ${token}` }),
    ...options.headers,
  };

  const response = await fetch(`${API_BASE}${url}`, {
    ...options,
    headers,
  });

  // Token expired or invalid — force logout and redirect to login
  if (response.status === 401) {
    localStorage.removeItem('keelo_token');
    localStorage.removeItem('keelo_user');
    localStorage.removeItem('keelo_demo_auth');
    window.location.href = '/login';
    throw new Error('Sessão expirada. Redirecionando para login...');
  }

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Unknown error' }));
    throw new Error(error.error || error.message || `HTTP ${response.status}`);
  }

  return response;
}

// Health Check
export async function getHealth(): Promise<{ status: string; database: { enabled: boolean } }> {
  const response = await fetchWithAuth('/health');
  return response.json();
}

// Analyses
export async function getAnalyses(params: {
  type?: string;
  trigger?: TriggerSource;
  repository?: string;
  risk?: string;
  limit?: number;
  offset?: number;
} = {}): Promise<AnalysisListResponse> {
  const searchParams = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined) searchParams.set(key, String(value));
  });
  
  const response = await fetchWithAuth(`/history?${searchParams}`);
  return response.json();
}

export async function getAnalysisById(id: string): Promise<{ success: boolean; data: Analysis }> {
  const response = await fetchWithAuth(`/history/${id}`);
  return response.json();
}

export async function getAnalysisDetails(id: string): Promise<{
  success: boolean;
  data: {
    analysis: Analysis;
    scenarios: Array<{
      id: string;
      title: string;
      category: string;
      priority: string;
      steps: string[];
      expected_result: string;
    }>;
    risks: Array<{ 
      title: string; 
      severity: string;
      area?: string;
      description?: string;
      mitigation?: string;
      probability?: string;
      impact?: string;
      tests_required?: string[];
    }>;
    gaps: Array<{ 
      title: string; 
      type?: 'missing_info' | 'ambiguity' | 'contradiction' | 'edge_case' | 'dangerous_assumption' | 'implicit_criterion' | 'unclear_behavior';
      question: string;
      recommendation?: string;
      risk_if_ignored?: string;
      severity?: string;
    }>;
    playwrightTests: Array<{
      name: string;
      description: string;
      code: string;
    }>;
    implementationPrompt?: string;
  };
}> {
  const response = await fetchWithAuth(`/history/${id}/details`);
  return response.json();
}

export async function getStats(): Promise<{ success: boolean; data: Stats }> {
  const response = await fetchWithAuth('/history/stats');
  return response.json();
}

export async function getRepositories(): Promise<{ success: boolean; data: Repository[] }> {
  const response = await fetchWithAuth('/history/repositories');
  return response.json();
}

export async function createRepositoryApi(fullName: string): Promise<{ success: boolean; data?: Repository; message?: string; error?: string }> {
  const response = await fetchWithAuth('/history/repositories', {
    method: 'POST',
    body: JSON.stringify({ fullName }),
  });
  return response.json();
}

export async function deleteRepositoryApi(id: string): Promise<{ success: boolean; message?: string; error?: string }> {
  const response = await fetchWithAuth(`/history/repositories/${id}`, {
    method: 'DELETE',
  });
  return response.json();
}

export async function getRepositoryHistory(
  owner: string,
  repo: string,
  limit = 20
): Promise<{ success: boolean; data: Analysis[] }> {
  const response = await fetchWithAuth(`/history/repository/${owner}/${repo}?limit=${limit}`);
  return response.json();
}

// Requirements Analysis
export interface RequirementsAnalysisResponse {
  success: boolean;
  analysisId?: string;
  status?: 'pending' | 'processing' | 'completed';
  message?: string;
  data?: unknown;
}

export async function analyzeRequirements(input: RequirementsInput): Promise<RequirementsAnalysisResponse> {
  const response = await fetchWithAuth('/analyze/requirements', {
    method: 'POST',
    body: JSON.stringify(input),
  });
  return response.json();
}

export async function analyzeUserStory(input: {
  story: string;
  acceptanceCriteria?: string;
  context?: string;
  metadata?: RequirementsInput['metadata'];
}): Promise<{
  success: boolean;
  analysisId?: string;
  data: unknown;
}> {
  const response = await fetchWithAuth('/analyze/user-story', {
    method: 'POST',
    body: JSON.stringify(input),
  });
  return response.json();
}

// Hot Spots
export async function getHotspots(params: {
  repository?: string;
  limit?: number;
} = {}): Promise<{ success: boolean; data: RiskHotspot[] }> {
  const searchParams = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined) searchParams.set(key, String(value));
  });
  
  const response = await fetchWithAuth(`/history/hotspots?${searchParams}`);
  return response.json();
}

export async function getHotspotSummary(
  repository?: string
): Promise<{ success: boolean; data: HotspotSummary }> {
  const params = repository ? `?repository=${encodeURIComponent(repository)}` : '';
  const response = await fetchWithAuth(`/history/hotspots/summary${params}`);
  return response.json();
}

export async function getHotspotsByArea(
  area: string,
  limit = 10
): Promise<{ success: boolean; data: RiskHotspot[] }> {
  const response = await fetchWithAuth(`/history/hotspots/area/${area}?limit=${limit}`);
  return response.json();
}

// =============================================================================
// QA Health Dashboard
// =============================================================================

export interface QAHealthMetrics {
  period: 'daily' | 'weekly' | 'monthly';
  dateRange: {
    start: string;
    end: string;
  };
  totalPRsAnalyzed: number;
  requirementsAnalyzed: number;
  testsGenerated: number;
  testPRsCreated: number;
  risks: {
    critical: number;
    high: number;
    medium: number;
    low: number;
    total: number;
  };
  coverage: {
    average: number;
    improved: number;
    decreased: number;
    unchanged: number;
  };
  scenarios: {
    total: number;
    byType: Record<string, number>;
  };
  gaps: {
    total: number;
    resolved: number;
    pending: number;
  };
  hotSpots: Array<{
    area: string;
    file_path: string;
    riskCount: number;
    lastRisk: string;
    lastRiskLevel: string;
  }>;
  prsWithoutTests: Array<{
    id: string;
    pr_number: number;
    pr_title: string;
    repository: string;
    created_at: string;
  }>;
  trends: {
    dates: string[];
    analysesCount: number[];
    risksCount: number[];
    testsGenerated: number[];
  };
}

export interface QAHealthSummary {
  healthScore: number;
  healthStatus: 'excellent' | 'good' | 'attention' | 'critical';
  totalAnalyses: number;
  testsGenerated: number;
  risksIdentified: number;
  criticalRisks: number;
  gapsFound: number;
  scenariosCreated: number;
  hotSpotsCount: number;
  prsWithoutTestsCount: number;
  effectiveness: {
    bugsPreventedEstimate: number;
    risksMitigated: number;
    coverageImprovement: number;
  };
  period: {
    start: string;
    end: string;
  };
}

export interface AreaCoverage {
  area: string;
  filesCount: number;
  testsCount: number;
  risksCount: number;
  coverageEstimate: number;
  lastAnalysis: string;
}

export type AudienceRole = 'cto' | 'pm' | 'qa';

export interface AudienceMetricCard {
  id: string;
  title: string;
  value: string;
  detail?: string;
}

export interface AudienceMetrics {
  audience: AudienceRole;
  period: 'daily' | 'weekly' | 'monthly';
  cards: AudienceMetricCard[];
  dataQuality: Record<
    string,
    {
      source: string;
      freshness: 'fresh' | 'stale' | 'unknown';
      confidence: 'high' | 'medium' | 'low';
      notes: string[];
    }
  >;
}

export async function getQAHealthMetrics(
  period: 'daily' | 'weekly' | 'monthly' = 'weekly'
): Promise<{ success: boolean; data: QAHealthMetrics }> {
  const response = await fetchWithAuth(`/qa-health?period=${period}`);
  return response.json();
}

export async function getQAHealthSummary(): Promise<{ success: boolean; data: QAHealthSummary }> {
  const response = await fetchWithAuth('/qa-health/summary');
  return response.json();
}

export async function getAreaCoverage(): Promise<{ success: boolean; data: AreaCoverage[] }> {
  const response = await fetchWithAuth('/qa-health/coverage');
  return response.json();
}

export async function sendQAHealthReportToSlack(
  period: 'daily' | 'weekly' = 'weekly'
): Promise<{ success: boolean; message?: string }> {
  const response = await fetchWithAuth('/qa-health/report/slack', {
    method: 'POST',
    body: JSON.stringify({ period }),
  });
  return response.json();
}

export async function sendWeeklyQualityReportToSlack(force = false): Promise<{ success: boolean; message?: string }> {
  const response = await fetchWithAuth('/qa-health/report/weekly', {
    method: 'POST',
    body: JSON.stringify({ force }),
  });
  return response.json();
}

export async function getAudienceMetrics(
  role: AudienceRole,
  period: 'daily' | 'weekly' | 'monthly' = 'weekly'
): Promise<{ success: boolean; data: AudienceMetrics }> {
  const response = await fetchWithAuth(`/qa-health/audience?role=${role}&period=${period}`);
  return response.json();
}

// Autonomy Metrics
export interface AutonomyMetrics {
  autoFix: {
    enabled: boolean;
    totalAttempts: number;
    successfulFixes: number;
    successRate: number;
    prsFixed: number;
  };
  period: string;
}

export interface ROIMetrics {
  period: string;
  activities: {
    prAnalyses: number;
    explorations: number;
    autoFixes: number;
  };
  timeSaved: {
    minutes: number;
    hours: number;
    formatted: string;
  };
  estimatedCostSaved: {
    value: number;
    formatted: string;
    note: string;
  };
}

export async function getAutonomyMetrics(): Promise<{ success: boolean; data: AutonomyMetrics }> {
  const response = await fetchWithAuth('/qa-health/autonomy');
  return response.json();
}

export async function getROIMetrics(): Promise<{ success: boolean; data: ROIMetrics }> {
  const response = await fetchWithAuth('/qa-health/roi');
  return response.json();
}

// =============================================================================
// Settings API
// =============================================================================

export interface KeeloConfig {
  language: string;
  trigger: string;
  llm: {
    provider: string;
    model: string;
    temperature: number;
    maxTokens: number;
  };
  testFrameworks: {
    e2e: string;
    unit: string;
    api: string;
  };
  actions: {
    autoGenerateTests: boolean;
    autoCreateIssues: boolean;
    autoCreateTasks: boolean;
    createDraftPRs: boolean;
    issueLabels: string[];
    autonomous: {
      enabled: boolean;
      createPR: boolean;
      monitorCI: boolean;
      autoFix: boolean;
      baseBranchStrategy: string;
    };
  };
  notifications: {
    slack: {
      enabled: boolean;
      webhookUrl: string;
      channel: string;
      notifyOn: {
        analysis: boolean;
        testPRCreated: boolean;
        ciFailure: boolean;
        criticalRisk: boolean;
      };
    };
  };
  coverage: {
    enabled: boolean;
    minThreshold: number;
    failOnDecrease: boolean;
    suggestTests: boolean;
  };
  feedback: {
    enabled: boolean;
    collectReactions: boolean;
    useLearning: boolean;
    showStats: boolean;
  };
  testOutputDir: string;
}

export interface ConfigOptions {
  language: Array<{ value: string; label: string }>;
  trigger: Array<{ value: string; label: string }>;
  llmProvider: Array<{ value: string; label: string }>;
  llmModel: {
    anthropic: Array<{ value: string; label: string }>;
    openai: Array<{ value: string; label: string }>;
  };
  e2eFramework: Array<{ value: string; label: string }>;
  unitFramework: Array<{ value: string; label: string }>;
  apiFramework: Array<{ value: string; label: string }>;
  baseBranchStrategy: Array<{ value: string; label: string }>;
}

export async function getSettings(): Promise<{ success: boolean; data: KeeloConfig }> {
  const response = await fetchWithAuth('/settings');
  return response.json();
}

export async function getSettingsOptions(): Promise<{ success: boolean; data: ConfigOptions }> {
  const response = await fetchWithAuth('/settings/options');
  return response.json();
}

export async function updateSettings(config: KeeloConfig): Promise<{ success: boolean; data: KeeloConfig }> {
  const response = await fetchWithAuth('/settings', {
    method: 'PUT',
    body: JSON.stringify(config),
  });
  return response.json();
}

export async function patchSettings(updates: Partial<KeeloConfig>): Promise<{ success: boolean; data: KeeloConfig }> {
  const response = await fetchWithAuth('/settings', {
    method: 'PATCH',
    body: JSON.stringify(updates),
  });
  return response.json();
}

export async function resetSettings(): Promise<{ success: boolean; data: KeeloConfig }> {
  const response = await fetchWithAuth('/settings/reset', {
    method: 'POST',
  });
  return response.json();
}

// =============================================================================
// Product Impact API (Pilar 3)
// =============================================================================

export interface ProductImpactReport {
  generatedAt: string;
  analysisId?: string;
  prNumber?: number;
  repository?: string;
  executiveSummary: string;
  productHealth: {
    score: number;
    status: 'healthy' | 'attention' | 'degraded' | 'critical';
    trend: string;
  };
  mergeDecision: {
    recommendation: string;
    emoji: string;
    label: string;
    reason: string;
  };
  uxImpact: Array<{
    area: string;
    issue: string;
    userImpact: string;
    severity: 'blocking' | 'frustrating' | 'annoying' | 'minor';
    metric?: string;
    affectedJourneys: string[];
  }>;
  businessRisks: Array<{
    title: string;
    businessImpact: string;
    affectedArea: string;
    urgency: 'immediate' | 'short-term' | 'long-term';
    originalRiskLevel: string;
    actionRequired: string;
  }>;
  recommendations: Array<{
    priority: 'must-do' | 'should-do' | 'nice-to-have';
    title: string;
    description: string;
    expectedOutcome: string;
    effort: 'low' | 'medium' | 'high';
  }>;
  metricsSummary: {
    totalRisks: number;
    criticalRisks: number;
    uxIssues: number;
    testScenarios: number;
    coverageGaps: number;
    riskScore: number;
  };
}

export interface ProductInsightsAggregate {
  period: string;
  totalAnalyses: number;
  summary: {
    totalRisks: number;
    criticalRisks: number;
    highRisks: number;
    totalScenarios: number;
    totalGaps: number;
  };
  mergeDecisions: {
    blocked: number;
    attention: number;
    approved: number;
  };
  topRiskAreas: Array<{ area: string; count: number }>;
  healthTrend: string;
  recentImpacts: Array<{
    prNumber?: number;
    repository?: string;
    riskLevel: string;
    title: string;
    date: string;
  }>;
}

export async function getProductImpactReport(analysisId: string): Promise<{ success: boolean; data: ProductImpactReport }> {
  const response = await fetchWithAuth(`/product-impact/${analysisId}`);
  return response.json();
}

export async function getProductImpactMarkdown(analysisId: string): Promise<string> {
  const response = await fetchWithAuth(`/product-impact/${analysisId}?format=markdown`);
  return response.text();
}

export async function sendProductImpactToSlack(analysisId: string): Promise<{ success: boolean; message: string }> {
  const response = await fetchWithAuth(`/product-impact/${analysisId}/slack`, {
    method: 'POST',
  });
  return response.json();
}

export async function getProductInsightsAggregate(days = 30): Promise<{ success: boolean; data: ProductInsightsAggregate }> {
  const response = await fetchWithAuth(`/product-impact/insights/aggregate?days=${days}`);
  return response.json();
}

// =============================================================================
// Organizations API
// =============================================================================

export async function getOrganizations(): Promise<{ success: boolean; data: Organization[] }> {
  const response = await fetchWithAuth('/organizations');
  return response.json();
}

export async function createOrganizationApi(data: {
  name: string;
  slug: string;
  avatar?: string;
}): Promise<{ success: boolean; data: Organization; error?: string }> {
  const response = await fetchWithAuth('/organizations', {
    method: 'POST',
    body: JSON.stringify(data),
  });
  return response.json();
}

export async function deleteOrganizationApi(orgId: string): Promise<{ success: boolean; message?: string; error?: string }> {
  const response = await fetchWithAuth(`/organizations/${orgId}`, {
    method: 'DELETE',
  });
  return response.json();
}

export async function getOrgMembers(orgId: string): Promise<{ success: boolean; data: OrgMember[] }> {
  const response = await fetchWithAuth(`/organizations/${orgId}/members`);
  return response.json();
}

export async function addOrgMemberApi(orgId: string, email: string, role = 'member'): Promise<{ success: boolean; data?: OrgMember; error?: string; message?: string }> {
  const response = await fetchWithAuth(`/organizations/${orgId}/members`, {
    method: 'POST',
    body: JSON.stringify({ email, role }),
  });
  return response.json();
}

export async function removeOrgMemberApi(orgId: string, userId: string): Promise<{ success: boolean; error?: string }> {
  const response = await fetchWithAuth(`/organizations/${orgId}/members/${userId}`, {
    method: 'DELETE',
  });
  return response.json();
}

export async function transferOwnershipApi(orgId: string, newOwnerId: string): Promise<{ success: boolean; message?: string; error?: string; details?: string }> {
  const response = await fetchWithAuth(`/organizations/${orgId}/transfer-ownership`, {
    method: 'POST',
    body: JSON.stringify({ newOwnerId }),
  });
  return response.json();
}

// =============================================================================
// Projects API
// =============================================================================

export async function getProjects(orgId: string): Promise<{ success: boolean; data: Project[] }> {
  const response = await fetchWithAuth(`/organizations/${orgId}/projects`);
  return response.json();
}

export async function createProjectApi(orgId: string, data: {
  name: string;
  slug: string;
  description?: string;
}): Promise<{ success: boolean; data: Project; error?: string }> {
  const response = await fetchWithAuth(`/organizations/${orgId}/projects`, {
    method: 'POST',
    body: JSON.stringify(data),
  });
  return response.json();
}

export async function deleteProjectApi(orgId: string, projectId: string): Promise<{ success: boolean; error?: string }> {
  const response = await fetchWithAuth(`/organizations/${orgId}/projects/${projectId}`, {
    method: 'DELETE',
  });
  return response.json();
}
