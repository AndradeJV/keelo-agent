import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  AlertTriangle,
  CheckCircle,
  FileSearch,
  GitPullRequest,
  TrendingUp,
  BarChart3,
  Database,
  Wifi,
  WifiOff,
  ExternalLink,
  Flame,
  MapPin,
  Settings,
  Plus,
  Trash2,
  X,
  Folder,
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { getStats, getAnalyses, getHealth, getHotspots, getRepositories, createRepositoryApi, deleteRepositoryApi, type Analysis, type Stats, type RiskHotspot, type Repository } from '../stores/api';
import { useRealtimeStore } from '../stores/realtime';
import RiskBadge from '../components/RiskBadge';
import StatCard from '../components/StatCard';

export default function Dashboard() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [recentAnalyses, setRecentAnalyses] = useState<Analysis[]>([]);
  const [hotspots, setHotspots] = useState<RiskHotspot[]>([]);
  const [repositories, setRepositories] = useState<Repository[]>([]);
  const [selectedProject, setSelectedProject] = useState<string>(() => {
    return localStorage.getItem('keelo_selected_project') || '';
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dbEnabled, setDbEnabled] = useState<boolean | null>(null);
  
  // Project management modal state
  const [showProjectModal, setShowProjectModal] = useState(false);
  const [newProjectName, setNewProjectName] = useState('');
  const [projectActionLoading, setProjectActionLoading] = useState(false);
  const [projectError, setProjectError] = useState<string | null>(null);
  
  const { connect, isConnected, analyses: realtimeAnalyses } = useRealtimeStore();

  useEffect(() => {
    connect();
    loadInitialData();
  }, []);

  // Reload data when project changes
  useEffect(() => {
    if (dbEnabled) {
      loadProjectData();
    }
  }, [selectedProject, dbEnabled]);

  // Persist project selection
  useEffect(() => {
    if (selectedProject) {
      localStorage.setItem('keelo_selected_project', selectedProject);
    } else {
      localStorage.removeItem('keelo_selected_project');
    }
  }, [selectedProject]);

  // Merge realtime analyses with database analyses (filtered by project if selected)
  const allAnalyses = [...realtimeAnalyses, ...recentAnalyses]
    .filter((a, i, arr) => arr.findIndex(x => x.id === a.id) === i)
    .filter(a => !selectedProject || a.repository === selectedProject)
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    .slice(0, 10);

  async function loadInitialData() {
    try {
      const health = await getHealth();
      setDbEnabled(health.database?.enabled ?? false);

      if (health.database?.enabled) {
        // Load repositories list
        const reposRes = await getRepositories();
        setRepositories(reposRes.data || []);
        
        // Load data for current project
        await loadProjectData();
      }
    } catch (err) {
      console.error('Failed to load dashboard data:', err);
      setError(err instanceof Error ? err.message : 'Erro ao carregar dados');
    } finally {
      setLoading(false);
    }
  }

  async function loadProjectData() {
    try {
      const filter = selectedProject ? { repository: selectedProject, limit: 5 } : { limit: 5 };
      
      const [statsRes, analysesRes, hotspotsRes] = await Promise.all([
        getStats(), // TODO: Add project filter to stats endpoint
        getAnalyses(filter),
        getHotspots({ repository: selectedProject, limit: 5 }).catch(() => ({ data: [] })),
      ]);
      setStats(statsRes.data);
      setRecentAnalyses(analysesRes.data);
      setHotspots(hotspotsRes.data || []);
    } catch (err) {
      console.error('Failed to load project data:', err);
    }
  }

  function handleProjectChange(project: string) {
    setSelectedProject(project);
  }

  async function handleAddProject() {
    if (!newProjectName.trim()) {
      setProjectError('Digite o nome do projeto');
      return;
    }
    if (!newProjectName.includes('/')) {
      setProjectError('Use o formato: owner/repo (ex: minha-org/meu-projeto)');
      return;
    }
    
    setProjectActionLoading(true);
    setProjectError(null);
    
    try {
      const result = await createRepositoryApi(newProjectName.trim());
      if (result.success) {
        setNewProjectName('');
        const reposRes = await getRepositories();
        setRepositories(reposRes.data || []);
      } else {
        setProjectError(result.error || 'Erro ao adicionar projeto');
      }
    } catch (err) {
      setProjectError('Erro de conexão');
    } finally {
      setProjectActionLoading(false);
    }
  }

  async function handleDeleteProject(repoId: string, repoName: string) {
    if (!confirm(`Tem certeza que deseja excluir "${repoName}" e todas as suas análises?`)) {
      return;
    }
    
    setProjectActionLoading(true);
    setProjectError(null);
    
    try {
      const result = await deleteRepositoryApi(repoId);
      if (result.success) {
        const reposRes = await getRepositories();
        setRepositories(reposRes.data || []);
        
        // If the deleted project was selected, clear selection
        if (selectedProject === repoName) {
          setSelectedProject('');
        }
      } else {
        setProjectError(result.error || 'Erro ao excluir projeto');
      }
    } catch (err) {
      setProjectError('Erro de conexão');
    } finally {
      setProjectActionLoading(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-4 border-keelo-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold text-dark-100">Dashboard</h1>
          <p className="text-dark-400 mt-1">Visão geral das análises de QA</p>
        </div>
        <div className="flex items-center gap-4 flex-wrap">
          {/* Project Selector */}
          {dbEnabled && (
            <div className="flex items-center gap-2">
              <select
                value={selectedProject}
                onChange={(e) => handleProjectChange(e.target.value)}
                className="bg-dark-800 border border-dark-700 rounded-lg px-3 py-2 text-sm text-dark-100 focus:outline-none focus:ring-2 focus:ring-keelo-500 focus:border-transparent min-w-[200px]"
              >
                <option value="">Todos os projetos</option>
                {repositories.map((repo) => (
                  <option key={repo.id} value={repo.full_name}>
                    📁 {repo.full_name} ({repo.analysis_count})
                  </option>
                ))}
              </select>
              <button
                onClick={() => setShowProjectModal(true)}
                className="p-2 bg-dark-800 border border-dark-700 rounded-lg text-dark-300 hover:text-keelo-400 hover:border-keelo-500/50 transition-colors"
                title="Gerenciar Projetos"
              >
                <Settings size={18} />
              </button>
            </div>
          )}

          {/* Database Status */}
          <div className="flex items-center gap-2">
            <Database size={16} className={dbEnabled ? 'text-keelo-500' : 'text-dark-500'} />
            <span className="text-sm text-dark-400">
              {dbEnabled ? 'DB Ativo' : 'DB Inativo'}
            </span>
          </div>
          
          {/* WebSocket Status */}
          <div className="flex items-center gap-2">
            {isConnected ? (
              <Wifi size={16} className="text-keelo-500" />
            ) : (
              <WifiOff size={16} className="text-dark-500" />
            )}
            <span className="text-sm text-dark-400">
              {isConnected ? 'Real-time' : 'Offline'}
            </span>
          </div>
        </div>
      </div>

      {/* Database Warning */}
      {dbEnabled === false && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="p-4 bg-yellow-500/10 border border-yellow-500/30 rounded-lg flex items-start gap-3"
        >
          <AlertTriangle className="w-5 h-5 text-yellow-500 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-yellow-400 font-medium">Banco de dados não configurado</p>
            <p className="text-dark-400 text-sm mt-1">
              Configure <code className="text-yellow-400">DATABASE_URL</code> no <code>.env</code> para habilitar o histórico.
              As análises em tempo real ainda funcionam via WebSocket.
            </p>
          </div>
        </motion.div>
      )}

      {/* Error */}
      {error && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="p-4 bg-red-500/10 border border-red-500/30 rounded-lg flex items-start gap-3"
        >
          <AlertTriangle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-red-400 font-medium">Erro ao carregar dados</p>
            <p className="text-dark-400 text-sm mt-1">{error}</p>
          </div>
        </motion.div>
      )}

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Total de Análises"
          value={stats?.totalAnalyses ?? realtimeAnalyses.length}
          icon={FileSearch}
          trend={stats?.completed ?? realtimeAnalyses.filter(a => a.status === 'completed').length}
          trendLabel="concluídas"
        />
        <StatCard
          title="Análises de PR"
          value={stats?.prAnalyses ?? realtimeAnalyses.filter(a => a.type === 'pr').length}
          icon={GitPullRequest}
          color="blue"
        />
        <StatCard
          title="Riscos Críticos"
          value={stats?.criticalCount ?? realtimeAnalyses.filter(a => a.overall_risk === 'critical').length}
          icon={AlertTriangle}
          color="red"
        />
        <StatCard
          title="Taxa de Sucesso"
          value={`${stats?.completed && stats?.totalAnalyses 
            ? Math.round((stats.completed / stats.totalAnalyses) * 100) 
            : realtimeAnalyses.length > 0 
              ? Math.round((realtimeAnalyses.filter(a => a.status === 'completed').length / realtimeAnalyses.length) * 100)
              : 0}%`}
          icon={TrendingUp}
          color="green"
        />
      </div>

      {/* Recent Analyses */}
      <div className="card">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-dark-100">
            Análises Recentes
            {isConnected && (
              <span className="ml-2 inline-flex items-center px-2 py-0.5 rounded text-xs bg-keelo-500/20 text-keelo-400">
                <span className="w-1.5 h-1.5 bg-keelo-500 rounded-full mr-1 animate-pulse" />
                ao vivo
              </span>
            )}
          </h2>
          {dbEnabled && (
            <Link to="/analyses" className="text-sm text-keelo-500 hover:text-keelo-400">
              Ver todas →
            </Link>
          )}
        </div>

        {allAnalyses.length === 0 ? (
          <div className="text-center py-8 text-dark-400">
            <FileSearch className="w-12 h-12 mx-auto mb-3 opacity-50" />
            <p>Nenhuma análise encontrada</p>
            <p className="text-sm mt-2">
              {isConnected 
                ? 'Aguardando análises via WebSocket...' 
                : 'Conecte-se ao WebSocket para receber atualizações em tempo real'}
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {allAnalyses.map((analysis, index) => (
              <motion.div
                key={analysis.id}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: index * 0.1 }}
              >
                <AnalysisRow analysis={analysis} dbEnabled={dbEnabled ?? false} />
              </motion.div>
            ))}
          </div>
        )}
      </div>

      {/* Quick Stats */}
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="card">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-lg bg-keelo-500/20 flex items-center justify-center">
                <BarChart3 className="w-5 h-5 text-keelo-500" />
              </div>
              <div>
                <p className="text-sm text-dark-400">Média de Cenários</p>
                <p className="text-xl font-bold text-dark-100">
                  {stats.avgScenarios?.toFixed(1) || 0}
                </p>
              </div>
            </div>
          </div>

          <div className="card">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-lg bg-orange-500/20 flex items-center justify-center">
                <AlertTriangle className="w-5 h-5 text-orange-500" />
              </div>
              <div>
                <p className="text-sm text-dark-400">Média de Riscos</p>
                <p className="text-xl font-bold text-dark-100">
                  {stats.avgRisks?.toFixed(1) || 0}
                </p>
              </div>
            </div>
          </div>

          <div className="card">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-lg bg-blue-500/20 flex items-center justify-center">
                <CheckCircle className="w-5 h-5 text-blue-500" />
              </div>
              <div>
                <p className="text-sm text-dark-400">Feedback Positivo</p>
                <p className="text-xl font-bold text-dark-100">
                  {stats.helpfulCount || 0}
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Risk Hot Spots */}
      {dbEnabled && hotspots.length > 0 && (
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Flame className="w-5 h-5 text-orange-500" />
              <h2 className="text-lg font-semibold text-dark-100">
                Hot Spots de Risco
              </h2>
            </div>
            <Link
              to="/hotspots"
              className="text-sm text-keelo-400 hover:text-keelo-300"
            >
              Ver todos
            </Link>
          </div>
          <p className="text-sm text-dark-400 mb-4">
            Áreas do código com maior incidência de riscos identificados
          </p>
          <div className="space-y-2">
            {hotspots.slice(0, 5).map((hotspot, index) => (
              <motion.div
                key={hotspot.id}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: index * 0.05 }}
                className="flex items-center gap-3 p-3 rounded-lg bg-dark-800/50 hover:bg-dark-800 transition-colors"
              >
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                  hotspot.critical_count > 0 
                    ? 'bg-red-500/20 text-red-400'
                    : hotspot.high_count > 0 
                    ? 'bg-orange-500/20 text-orange-400'
                    : 'bg-yellow-500/20 text-yellow-400'
                }`}>
                  <MapPin size={16} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-dark-200 truncate" title={hotspot.file_path}>
                    {hotspot.file_path.split('/').slice(-2).join('/')}
                  </p>
                  <p className="text-xs text-dark-400">
                    {hotspot.total_risks} riscos · {hotspot.critical_count} críticos · {hotspot.high_count} altos
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <div className={`px-2 py-1 rounded text-xs font-medium ${
                    hotspot.last_risk_level === 'critical'
                      ? 'bg-red-500/20 text-red-400'
                      : hotspot.last_risk_level === 'high'
                      ? 'bg-orange-500/20 text-orange-400'
                      : hotspot.last_risk_level === 'medium'
                      ? 'bg-yellow-500/20 text-yellow-400'
                      : 'bg-green-500/20 text-green-400'
                  }`}>
                    Score: {hotspot.risk_score}
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      )}

      {/* Project Management Modal */}
      <AnimatePresence>
        {showProjectModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50"
            onClick={() => setShowProjectModal(false)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-dark-900 border border-dark-700 rounded-xl p-6 w-full max-w-lg mx-4 max-h-[80vh] overflow-hidden flex flex-col"
            >
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-keelo-500/20 flex items-center justify-center">
                    <Folder className="w-5 h-5 text-keelo-400" />
                  </div>
                  <div>
                    <h2 className="text-xl font-semibold text-dark-100">Gerenciar Projetos</h2>
                    <p className="text-sm text-dark-400">Adicione ou remova projetos</p>
                  </div>
                </div>
                <button
                  onClick={() => setShowProjectModal(false)}
                  className="p-2 text-dark-400 hover:text-dark-100 hover:bg-dark-800 rounded-lg transition-colors"
                >
                  <X size={20} />
                </button>
              </div>

              {/* Add Project Form */}
              <div className="mb-6">
                <label className="block text-sm font-medium text-dark-300 mb-2">
                  Adicionar Novo Projeto
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={newProjectName}
                    onChange={(e) => setNewProjectName(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleAddProject()}
                    placeholder="owner/repo (ex: minha-org/meu-projeto)"
                    className="flex-1 bg-dark-800 border border-dark-700 rounded-lg px-4 py-2 text-dark-100 placeholder-dark-500 focus:outline-none focus:ring-2 focus:ring-keelo-500 focus:border-transparent"
                    disabled={projectActionLoading}
                  />
                  <button
                    onClick={handleAddProject}
                    disabled={projectActionLoading || !newProjectName.trim()}
                    className="px-4 py-2 bg-keelo-500 text-white rounded-lg font-medium hover:bg-keelo-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
                  >
                    {projectActionLoading ? (
                      <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    ) : (
                      <Plus size={18} />
                    )}
                    Adicionar
                  </button>
                </div>
                {projectError && (
                  <p className="mt-2 text-sm text-red-400">{projectError}</p>
                )}
              </div>

              {/* Project List */}
              <div className="flex-1 overflow-y-auto">
                <p className="text-sm font-medium text-dark-300 mb-3">
                  Projetos ({repositories.length})
                </p>
                {repositories.length === 0 ? (
                  <div className="text-center py-8">
                    <Folder className="w-12 h-12 text-dark-600 mx-auto mb-3" />
                    <p className="text-dark-400">Nenhum projeto cadastrado</p>
                    <p className="text-sm text-dark-500 mt-1">
                      Adicione projetos manualmente ou eles serão criados automaticamente ao analisar PRs
                    </p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {repositories.map((repo) => (
                      <div
                        key={repo.id}
                        className="flex items-center justify-between p-3 bg-dark-800/50 rounded-lg group hover:bg-dark-800 transition-colors"
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <Folder className="w-5 h-5 text-keelo-400 flex-shrink-0" />
                          <div className="min-w-0">
                            <p className="font-medium text-dark-200 truncate">
                              {repo.full_name}
                            </p>
                            <p className="text-xs text-dark-400">
                              {repo.analysis_count} análise{repo.analysis_count !== 1 ? 's' : ''}
                              {repo.last_analysis_at && ` · Última: ${formatDistanceToNow(new Date(repo.last_analysis_at), { addSuffix: true, locale: ptBR })}`}
                            </p>
                          </div>
                        </div>
                        <button
                          onClick={() => handleDeleteProject(repo.id, repo.full_name)}
                          disabled={projectActionLoading}
                          className="p-2 text-dark-500 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors opacity-0 group-hover:opacity-100 disabled:opacity-50"
                          title="Excluir projeto"
                        >
                          <Trash2 size={18} />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Footer */}
              <div className="mt-6 pt-4 border-t border-dark-700">
                <p className="text-xs text-dark-500 text-center">
                  ⚠️ Excluir um projeto remove todas as suas análises e hotspots
                </p>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function AnalysisRow({ analysis, dbEnabled }: { analysis: Analysis; dbEnabled: boolean }) {
  // Build PR URL if not present
  const prUrl = analysis.pr_url || 
    (analysis.repository && analysis.pr_number 
      ? `https://github.com/${analysis.repository}/pull/${analysis.pr_number}`
      : undefined);

  const content = (
    <div className="flex items-center gap-4 p-4 rounded-lg bg-dark-800/50 hover:bg-dark-800 transition-colors group">
      {/* Type Icon */}
      <div
        className={`w-10 h-10 rounded-lg flex items-center justify-center ${
          analysis.type === 'pr'
            ? 'bg-blue-500/20 text-blue-400'
            : 'bg-purple-500/20 text-purple-400'
        }`}
      >
        {analysis.type === 'pr' ? (
          <GitPullRequest size={20} />
        ) : (
          <FileSearch size={20} />
        )}
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <p className="font-medium text-dark-100 truncate group-hover:text-keelo-400 transition-colors">
          {analysis.pr_title || analysis.feature_name || analysis.summary_title || 'Análise'}
        </p>
        <p className="text-sm text-dark-400 truncate">
          {analysis.type === 'pr' && analysis.pr_number && `PR #${analysis.pr_number}`}
          {analysis.project_name && ` · ${analysis.project_name}`}
        </p>
      </div>

      {/* Status & Risk */}
      <div className="flex items-center gap-3">
        {/* Trigger source badge */}
        {analysis.trigger_source && (
          <span
            className={`px-1.5 py-0.5 rounded text-[10px] font-medium uppercase tracking-wide ${
              analysis.trigger_source === 'silent'
                ? 'bg-dark-700 text-dark-400'
                : analysis.trigger_source === 'command'
                ? 'bg-keelo-500/20 text-keelo-400'
                : 'bg-blue-500/20 text-blue-400'
            }`}
            title={
              analysis.trigger_source === 'silent'
                ? 'Análise automática (somente dashboard)'
                : analysis.trigger_source === 'command'
                ? 'Análise sob demanda (/keelo)'
                : 'Análise automática'
            }
          >
            {analysis.trigger_source === 'silent' ? 'Auto' : analysis.trigger_source === 'command' ? 'Sob demanda' : 'Auto'}
          </span>
        )}
        {analysis.overall_risk && <RiskBadge risk={analysis.overall_risk} />}
        <StatusIndicator status={analysis.status} />
        <span className="text-xs text-dark-500">
          {formatDistanceToNow(new Date(analysis.created_at), {
            addSuffix: true,
            locale: ptBR,
          })}
        </span>
        
        {/* PR Link */}
        {prUrl && (
          <a
            href={prUrl}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
            className="p-1.5 rounded-md bg-dark-700 hover:bg-dark-600 text-dark-400 hover:text-keelo-400 transition-colors"
            title="Ver PR no GitHub"
          >
            <ExternalLink size={14} />
          </a>
        )}
      </div>
    </div>
  );

  // If DB is enabled, make it a link
  if (dbEnabled && analysis.id && !analysis.id.startsWith('temp-')) {
    return <Link to={`/analyses/${analysis.id}`}>{content}</Link>;
  }

  return content;
}

function StatusIndicator({ status }: { status: string }) {
  const config = {
    pending: { color: 'bg-yellow-500', label: 'Pendente' },
    processing: { color: 'bg-blue-500 animate-pulse', label: 'Processando' },
    completed: { color: 'bg-green-500', label: 'Concluído' },
    failed: { color: 'bg-red-500', label: 'Falhou' },
  };

  const { color, label } = config[status as keyof typeof config] || config.pending;

  return (
    <div className={`w-2 h-2 rounded-full ${color}`} title={label} />
  );
}
