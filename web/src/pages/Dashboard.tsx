import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
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
  Building2,
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { getStats, getAnalyses, getHealth, getHotspots, type Analysis, type Stats, type RiskHotspot } from '../stores/api';
import { useRealtimeStore } from '../stores/realtime';
import { useWorkspaceStore } from '../stores/workspace';
import RiskBadge from '../components/RiskBadge';
import StatCard from '../components/StatCard';

export default function Dashboard() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [recentAnalyses, setRecentAnalyses] = useState<Analysis[]>([]);
  const [hotspots, setHotspots] = useState<RiskHotspot[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dbEnabled, setDbEnabled] = useState<boolean | null>(null);
  
  const { connect, isConnected, analyses: realtimeAnalyses } = useRealtimeStore();
  const { currentOrg, currentProject } = useWorkspaceStore();

  useEffect(() => {
    connect();
    loadInitialData();
  }, []);

  // Reload data when org/project changes
  useEffect(() => {
    if (dbEnabled) {
      loadProjectData();
    }
  }, [currentOrg?.id, currentProject?.id, dbEnabled]);

  // Merge realtime analyses with database analyses
  const allAnalyses = [...realtimeAnalyses, ...recentAnalyses]
    .filter((a, i, arr) => arr.findIndex(x => x.id === a.id) === i)
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    .slice(0, 10);

  async function loadInitialData() {
    try {
      const health = await getHealth();
      setDbEnabled(health.database?.enabled ?? false);

      if (health.database?.enabled) {
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
      const filter: Record<string, string | number> = { limit: 5 };
      if (currentProject?.id) {
        filter.projectId = currentProject.id;
      } else if (currentOrg?.id) {
        filter.organizationId = currentOrg.id;
      }
      
      const [statsRes, analysesRes, hotspotsRes] = await Promise.all([
        getStats(),
        getAnalyses(filter),
        getHotspots({ limit: 5 }).catch(() => ({ data: [] })),
      ]);
      setStats(statsRes.data);
      setRecentAnalyses(analysesRes.data);
      setHotspots(hotspotsRes.data || []);
    } catch (err) {
      console.error('Failed to load project data:', err);
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
          <p className="text-dark-400 mt-1">
            {currentOrg ? (
              <span className="flex items-center gap-1.5">
                <Building2 size={14} />
                {currentOrg.name}
                {currentProject && <span> / {currentProject.name}</span>}
              </span>
            ) : (
              'Visão geral das análises de QA'
            )}
          </p>
        </div>
        <div className="flex items-center gap-4 flex-wrap">
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

      {/* No Org CTA */}
      {dbEnabled && !currentOrg && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="p-6 bg-keelo-500/10 border border-keelo-500/30 rounded-lg text-center"
        >
          <Building2 className="w-12 h-12 text-keelo-400 mx-auto mb-3" />
          <h3 className="text-lg font-semibold text-dark-100 mb-1">Crie sua organização</h3>
          <p className="text-dark-400 text-sm mb-4">
            Para começar, crie uma organização e adicione seus projetos.
          </p>
          <Link
            to="/onboarding"
            className="inline-flex items-center gap-2 px-4 py-2 bg-keelo-500 text-white rounded-lg font-medium hover:bg-keelo-600 transition-colors"
          >
            <Building2 size={18} />
            Criar organização
          </Link>
        </motion.div>
      )}
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
