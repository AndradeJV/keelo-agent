import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  GitPullRequest,
  Search,
  RefreshCw,
  Clock,
  CheckCircle,
  AlertTriangle,
  Activity,
  ExternalLink,
  Sparkles,
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { getAnalyses, type Analysis, type TriggerSource } from '../stores/api';
import RiskBadge from '../components/RiskBadge';

type TabType = 'pr' | 'requirements';
type FilterRisk = 'all' | 'critical' | 'high' | 'medium' | 'low';
type FilterStatus = 'all' | 'completed' | 'processing' | 'pending' | 'failed';
type FilterTrigger = 'all' | TriggerSource;

export default function Analyses() {
  const [activeTab, setActiveTab] = useState<TabType>('pr');
  const [analyses, setAnalyses] = useState<Analysis[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Filters for PR tab
  const [prFilterRisk, setPrFilterRisk] = useState<FilterRisk>('all');
  const [prFilterStatus, setPrFilterStatus] = useState<FilterStatus>('all');
  const [prFilterTrigger, setPrFilterTrigger] = useState<FilterTrigger>('all');
  const [prSearchQuery, setPrSearchQuery] = useState('');

  // Filters for Requirements tab
  const [reqFilterRisk, setReqFilterRisk] = useState<FilterRisk>('all');
  const [reqFilterStatus, setReqFilterStatus] = useState<FilterStatus>('all');
  const [reqSearchQuery, setReqSearchQuery] = useState('');

  useEffect(() => {
    loadAnalyses();
  }, [activeTab, prFilterRisk, prFilterStatus, prFilterTrigger, reqFilterRisk, reqFilterStatus]);

  async function loadAnalyses() {
    setLoading(true);
    try {
      const filterRisk = activeTab === 'pr' ? prFilterRisk : reqFilterRisk;
      const filterStatus = activeTab === 'pr' ? prFilterStatus : reqFilterStatus;
      const filterTrigger = activeTab === 'pr' ? prFilterTrigger : 'all';

      const params: Record<string, string> = { 
        limit: '50',
        type: activeTab,
      };
      if (filterRisk !== 'all') params.risk = filterRisk;
      if (filterStatus !== 'all') params.status = filterStatus;
      if (filterTrigger !== 'all') params.trigger = filterTrigger;

      const response = await getAnalyses(params);
      setAnalyses(response.data);
    } catch (error) {
      console.error('Failed to load analyses:', error);
    } finally {
      setLoading(false);
    }
  }

  const searchQuery = activeTab === 'pr' ? prSearchQuery : reqSearchQuery;
  
  const filteredAnalyses = analyses.filter((a) => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      a.pr_title?.toLowerCase().includes(query) ||
      a.feature_name?.toLowerCase().includes(query) ||
      a.project_name?.toLowerCase().includes(query) ||
      a.summary_title?.toLowerCase().includes(query)
    );
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-dark-100">Análises</h1>
          <p className="text-dark-400 mt-1">Histórico de todas as análises realizadas</p>
        </div>
        <button
          onClick={loadAnalyses}
          className="btn-secondary flex items-center gap-2"
          disabled={loading}
        >
          <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
          Atualizar
        </button>
      </div>

      {/* Tabs */}
      <div className="border-b border-dark-700">
        <div className="flex gap-1">
          <button
            onClick={() => setActiveTab('pr')}
            className={`flex items-center gap-2 px-4 py-3 border-b-2 transition-all ${
              activeTab === 'pr'
                ? 'border-keelo-500 text-keelo-400'
                : 'border-transparent text-dark-400 hover:text-dark-200 hover:border-dark-600'
            }`}
          >
            <GitPullRequest size={18} />
            <span className="font-medium">Pull Requests</span>
          </button>
          
          <button
            onClick={() => setActiveTab('requirements')}
            className={`flex items-center gap-2 px-4 py-3 border-b-2 transition-all ${
              activeTab === 'requirements'
                ? 'border-keelo-500 text-keelo-400'
                : 'border-transparent text-dark-400 hover:text-dark-200 hover:border-dark-600'
            }`}
          >
            <Sparkles size={18} />
            <span className="font-medium">Requisitos</span>
          </button>
        </div>
      </div>

      {/* Tab Content */}
      <AnimatePresence mode="wait">
        <motion.div
          key={activeTab}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          transition={{ duration: 0.2 }}
        >
          {activeTab === 'pr' ? (
            <PRTabContent
              analyses={filteredAnalyses}
              loading={loading}
              searchQuery={prSearchQuery}
              setSearchQuery={setPrSearchQuery}
              filterRisk={prFilterRisk}
              setFilterRisk={setPrFilterRisk}
              filterStatus={prFilterStatus}
              setFilterStatus={setPrFilterStatus}
              filterTrigger={prFilterTrigger}
              setFilterTrigger={setPrFilterTrigger}
            />
          ) : (
            <RequirementsTabContent
              analyses={filteredAnalyses}
              loading={loading}
              searchQuery={reqSearchQuery}
              setSearchQuery={setReqSearchQuery}
              filterRisk={reqFilterRisk}
              setFilterRisk={setReqFilterRisk}
              filterStatus={reqFilterStatus}
              setFilterStatus={setReqFilterStatus}
            />
          )}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}

// =============================================================================
// PR Tab Content
// =============================================================================

interface TabContentProps {
  analyses: Analysis[];
  loading: boolean;
  searchQuery: string;
  setSearchQuery: (q: string) => void;
  filterRisk: FilterRisk;
  setFilterRisk: (r: FilterRisk) => void;
  filterStatus: FilterStatus;
  setFilterStatus: (s: FilterStatus) => void;
  filterTrigger?: FilterTrigger;
  setFilterTrigger?: (t: FilterTrigger) => void;
}

function PRTabContent({
  analyses,
  loading,
  searchQuery,
  setSearchQuery,
  filterRisk,
  setFilterRisk,
  filterStatus,
  setFilterStatus,
  filterTrigger = 'all',
  setFilterTrigger,
}: TabContentProps) {
  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-dark-400" />
          <input
            type="text"
            placeholder="Buscar por título do PR, repositório..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="input pl-10"
          />
        </div>

        <div className="flex gap-2">
          <select
            value={filterRisk}
            onChange={(e) => setFilterRisk(e.target.value as FilterRisk)}
            className="input w-auto"
          >
            <option value="all">Todos os riscos</option>
            <option value="critical">🔴 Crítico</option>
            <option value="high">🟠 Alto</option>
            <option value="medium">🟡 Médio</option>
            <option value="low">🟢 Baixo</option>
          </select>

          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value as FilterStatus)}
            className="input w-auto"
          >
            <option value="all">Todos os status</option>
            <option value="completed">✅ Concluídos</option>
            <option value="processing">🔄 Processando</option>
            <option value="pending">⏳ Pendentes</option>
            <option value="failed">❌ Falhou</option>
          </select>

          {setFilterTrigger && (
            <select
              value={filterTrigger}
              onChange={(e) => setFilterTrigger(e.target.value as FilterTrigger)}
              className="input w-auto"
            >
              <option value="all">Todas as origens</option>
              <option value="auto">🔄 Automático</option>
              <option value="command">💬 Sob demanda</option>
              <option value="silent">👁️ Dashboard (híbrido)</option>
            </select>
          )}
        </div>
      </div>

      {/* Results */}
      <AnalysisList analyses={analyses} loading={loading} type="pr" />
    </div>
  );
}

// =============================================================================
// Requirements Tab Content
// =============================================================================

function RequirementsTabContent({
  analyses,
  loading,
  searchQuery,
  setSearchQuery,
  filterRisk,
  setFilterRisk,
  filterStatus,
  setFilterStatus,
}: TabContentProps) {
  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-dark-400" />
          <input
            type="text"
            placeholder="Buscar por feature, projeto, sprint..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="input pl-10"
          />
        </div>

        <div className="flex gap-2">
          <select
            value={filterRisk}
            onChange={(e) => setFilterRisk(e.target.value as FilterRisk)}
            className="input w-auto"
          >
            <option value="all">Todos os riscos</option>
            <option value="critical">🔴 Crítico</option>
            <option value="high">🟠 Alto</option>
            <option value="medium">🟡 Médio</option>
            <option value="low">🟢 Baixo</option>
          </select>

          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value as FilterStatus)}
            className="input w-auto"
          >
            <option value="all">Todos os status</option>
            <option value="completed">✅ Concluídos</option>
            <option value="processing">🔄 Analisando</option>
            <option value="pending">⏳ Na fila</option>
            <option value="failed">❌ Falhou</option>
          </select>
        </div>
      </div>

      {/* Results */}
      <AnalysisList analyses={analyses} loading={loading} type="requirements" />
    </div>
  );
}

// =============================================================================
// Analysis List Component
// =============================================================================

function AnalysisList({ 
  analyses, 
  loading, 
  type 
}: { 
  analyses: Analysis[]; 
  loading: boolean;
  type: 'pr' | 'requirements';
}) {
  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-4 border-keelo-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (analyses.length === 0) {
    return (
      <div className="card text-center py-12">
        {type === 'pr' ? (
          <>
            <GitPullRequest className="w-16 h-16 mx-auto text-dark-600 mb-4" />
            <h3 className="text-lg font-medium text-dark-300">Nenhuma análise de PR encontrada</h3>
            <p className="text-dark-500 mt-1">Análises de PRs aparecerão aqui automaticamente</p>
          </>
        ) : (
          <>
            <Sparkles className="w-16 h-16 mx-auto text-dark-600 mb-4" />
            <h3 className="text-lg font-medium text-dark-300">Nenhuma análise de requisitos encontrada</h3>
            <p className="text-dark-500 mt-1">
              Vá para a página de Requisitos para criar uma nova análise
            </p>
          </>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {analyses.map((analysis, index) => (
        <motion.div
          key={analysis.id}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: index * 0.03 }}
        >
          <AnalysisCard analysis={analysis} />
        </motion.div>
      ))}
    </div>
  );
}

// =============================================================================
// Analysis Card Component
// =============================================================================

function AnalysisCard({ analysis }: { analysis: Analysis }) {
  const statusConfig = {
    pending: { color: 'text-yellow-400', bg: 'bg-yellow-500/20', icon: Clock, label: 'Pendente' },
    processing: { color: 'text-blue-400', bg: 'bg-blue-500/20', icon: Activity, label: 'Processando' },
    completed: { color: 'text-green-400', bg: 'bg-green-500/20', icon: CheckCircle, label: 'Concluído' },
    failed: { color: 'text-red-400', bg: 'bg-red-500/20', icon: AlertTriangle, label: 'Falhou' },
  };

  const status = statusConfig[analysis.status] || statusConfig.pending;
  const StatusIcon = status.icon;
  const isPR = analysis.type === 'pr';

  return (
    <Link
      to={`/analyses/${analysis.id}`}
      className="card-hover block"
    >
      <div className="flex items-start gap-4">
        {/* Type Icon */}
        <div
          className={`w-12 h-12 rounded-lg flex items-center justify-center flex-shrink-0 ${
            isPR
              ? 'bg-blue-500/20 text-blue-400'
              : 'bg-purple-500/20 text-purple-400'
          }`}
        >
          {isPR ? (
            <GitPullRequest size={24} />
          ) : (
            <Sparkles size={24} />
          )}
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <h3 className="font-medium text-dark-100 truncate">
                {analysis.pr_title || analysis.feature_name || analysis.summary_title || 'Análise'}
              </h3>
              <p className="text-sm text-dark-400 mt-1">
                {isPR && analysis.pr_number && (
                  <span className="text-blue-400">PR #{analysis.pr_number}</span>
                )}
                {!isPR && analysis.feature_name && (
                  <span className="text-purple-400">{analysis.feature_name}</span>
                )}
                {analysis.project_name && <span> · {analysis.project_name}</span>}
                {analysis.sprint && <span> · {analysis.sprint}</span>}
              </p>
            </div>

            <div className="flex items-center gap-2">
              {/* Trigger source indicator */}
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
                      ? 'Monitoramento automático (somente dashboard)'
                      : analysis.trigger_source === 'command'
                      ? 'Sob demanda via /keelo'
                      : 'Análise automática completa'
                  }
                >
                  {analysis.trigger_source === 'silent' ? 'Auto' : analysis.trigger_source === 'command' ? 'Sob demanda' : 'Auto'}
                </span>
              )}
              {analysis.overall_risk && <RiskBadge risk={analysis.overall_risk} />}
              <span className={`flex items-center gap-1 px-2 py-1 rounded-full text-xs ${status.bg} ${status.color}`}>
                <StatusIcon size={12} />
                {status.label}
              </span>
            </div>
          </div>

          {/* Stats */}
          <div className="flex items-center gap-6 mt-3 text-sm text-dark-400">
            <span>📋 {analysis.scenarios_count} cenários</span>
            <span>⚠️ {analysis.risks_count} riscos</span>
            <span>❓ {analysis.gaps_count} gaps</span>
            <span className="ml-auto text-dark-500">
              {formatDistanceToNow(new Date(analysis.created_at), {
                addSuffix: true,
                locale: ptBR,
              })}
            </span>
            
            {/* PR Link */}
            {analysis.pr_url && (
              <a
                href={analysis.pr_url}
                target="_blank"
                rel="noopener noreferrer"
                onClick={(e) => e.stopPropagation()}
                className="flex items-center gap-1 px-2 py-1 rounded-md bg-dark-700 hover:bg-dark-600 text-dark-400 hover:text-keelo-400 transition-colors"
                title="Ver PR no GitHub"
              >
                <ExternalLink size={14} />
                <span className="hidden sm:inline">GitHub</span>
              </a>
            )}
          </div>
        </div>
      </div>
    </Link>
  );
}
