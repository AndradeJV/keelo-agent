import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import {
  Flame,
  MapPin,
  AlertTriangle,
  TrendingUp,
  FileCode,
  ChevronDown,
  ChevronUp,
  Filter,
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { getHotspots, getHotspotSummary, type RiskHotspot, type HotspotSummary } from '../stores/api';

export default function Hotspots() {
  const [hotspots, setHotspots] = useState<RiskHotspot[]>([]);
  const [summary, setSummary] = useState<HotspotSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [selectedArea, setSelectedArea] = useState<string>('all');

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    try {
      setLoading(true);
      const [hotspotsRes, summaryRes] = await Promise.all([
        getHotspots({ limit: 50 }),
        getHotspotSummary(),
      ]);
      setHotspots(hotspotsRes.data || []);
      setSummary(summaryRes.data);
    } catch (err) {
      console.error('Failed to load hotspots:', err);
      setError(err instanceof Error ? err.message : 'Erro ao carregar dados');
    } finally {
      setLoading(false);
    }
  }

  const filteredHotspots = selectedArea === 'all' 
    ? hotspots 
    : hotspots.filter(h => h.area_name === selectedArea);

  const uniqueAreas = [...new Set(hotspots.map(h => h.area_name))].sort();

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-4 border-keelo-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="card text-center py-8">
        <AlertTriangle className="w-12 h-12 text-red-500 mx-auto mb-4" />
        <h2 className="text-lg font-semibold text-dark-100 mb-2">Erro ao carregar</h2>
        <p className="text-dark-400">{error}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-dark-100 flex items-center gap-2">
            <Flame className="w-7 h-7 text-orange-500" />
            Hot Spots de Risco
          </h1>
          <p className="text-dark-400 mt-1">
            Áreas do código com maior incidência de riscos identificados
          </p>
        </div>
      </div>

      {/* Summary Cards */}
      {summary && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="card"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-orange-500/20 flex items-center justify-center">
                <MapPin className="w-5 h-5 text-orange-500" />
              </div>
              <div>
                <p className="text-sm text-dark-400">Total de Hot Spots</p>
                <p className="text-2xl font-bold text-dark-100">{summary.totalHotspots}</p>
              </div>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="card"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-red-500/20 flex items-center justify-center">
                <AlertTriangle className="w-5 h-5 text-red-500" />
              </div>
              <div>
                <p className="text-sm text-dark-400">Áreas Críticas</p>
                <p className="text-2xl font-bold text-dark-100">{summary.criticalAreas}</p>
              </div>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="card col-span-2"
          >
            <div className="flex items-center gap-3 mb-3">
              <TrendingUp className="w-5 h-5 text-keelo-500" />
              <p className="text-sm text-dark-400">Top Áreas por Riscos</p>
            </div>
            <div className="flex flex-wrap gap-2">
              {summary.topAreas.map((area, i) => (
                <span
                  key={area.area}
                  className={`px-3 py-1.5 rounded-full text-sm font-medium ${
                    i === 0 ? 'bg-red-500/20 text-red-400' :
                    i === 1 ? 'bg-orange-500/20 text-orange-400' :
                    'bg-yellow-500/20 text-yellow-400'
                  }`}
                >
                  {area.area}: {area.count}
                </span>
              ))}
            </div>
          </motion.div>
        </div>
      )}

      {/* Filter */}
      <div className="flex items-center gap-3">
        <Filter className="w-4 h-4 text-dark-400" />
        <select
          value={selectedArea}
          onChange={(e) => setSelectedArea(e.target.value)}
          className="bg-dark-800 border border-dark-700 rounded-lg px-3 py-2 text-sm text-dark-100 focus:border-keelo-500 focus:outline-none"
        >
          <option value="all">Todas as áreas ({hotspots.length})</option>
          {uniqueAreas.map(area => (
            <option key={area} value={area}>
              {area} ({hotspots.filter(h => h.area_name === area).length})
            </option>
          ))}
        </select>
      </div>

      {/* Hotspots List */}
      {filteredHotspots.length === 0 ? (
        <div className="card text-center py-12">
          <MapPin className="w-12 h-12 text-dark-600 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-dark-300 mb-2">Nenhum hot spot encontrado</h3>
          <p className="text-dark-500">
            Hot spots são identificados conforme análises de PRs são realizadas
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredHotspots.map((hotspot, index) => (
            <motion.div
              key={hotspot.id}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: index * 0.03 }}
              className="card"
            >
              <div
                className="flex items-center gap-4 cursor-pointer"
                onClick={() => setExpandedId(expandedId === hotspot.id ? null : hotspot.id)}
              >
                {/* Risk indicator */}
                <div className={`w-12 h-12 rounded-lg flex items-center justify-center shrink-0 ${
                  hotspot.critical_count > 0 
                    ? 'bg-red-500/20'
                    : hotspot.high_count > 0 
                    ? 'bg-orange-500/20'
                    : hotspot.medium_count > 0
                    ? 'bg-yellow-500/20'
                    : 'bg-green-500/20'
                }`}>
                  <FileCode className={`w-6 h-6 ${
                    hotspot.critical_count > 0 
                      ? 'text-red-400'
                      : hotspot.high_count > 0 
                      ? 'text-orange-400'
                      : hotspot.medium_count > 0
                      ? 'text-yellow-400'
                      : 'text-green-400'
                  }`} />
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-dark-100 truncate" title={hotspot.file_path}>
                    {hotspot.file_path}
                  </p>
                  <div className="flex items-center gap-3 text-sm text-dark-400 mt-1">
                    <span className="px-2 py-0.5 rounded bg-dark-700 text-dark-300">
                      {hotspot.area_name}
                    </span>
                    <span>{hotspot.total_risks} riscos</span>
                    <span>•</span>
                    <span>{hotspot.pr_count} PRs</span>
                  </div>
                </div>

                {/* Stats */}
                <div className="flex items-center gap-4">
                  {hotspot.critical_count > 0 && (
                    <span className="flex items-center gap-1 text-red-400 text-sm">
                      <span className="w-2 h-2 rounded-full bg-red-500" />
                      {hotspot.critical_count}
                    </span>
                  )}
                  {hotspot.high_count > 0 && (
                    <span className="flex items-center gap-1 text-orange-400 text-sm">
                      <span className="w-2 h-2 rounded-full bg-orange-500" />
                      {hotspot.high_count}
                    </span>
                  )}
                  {hotspot.medium_count > 0 && (
                    <span className="flex items-center gap-1 text-yellow-400 text-sm">
                      <span className="w-2 h-2 rounded-full bg-yellow-500" />
                      {hotspot.medium_count}
                    </span>
                  )}
                  
                  <div className={`px-3 py-1.5 rounded-lg text-sm font-bold ${
                    hotspot.risk_score >= 50 
                      ? 'bg-red-500/20 text-red-400'
                      : hotspot.risk_score >= 20
                      ? 'bg-orange-500/20 text-orange-400'
                      : 'bg-yellow-500/20 text-yellow-400'
                  }`}>
                    Score: {hotspot.risk_score}
                  </div>

                  {expandedId === hotspot.id ? (
                    <ChevronUp className="w-5 h-5 text-dark-400" />
                  ) : (
                    <ChevronDown className="w-5 h-5 text-dark-400" />
                  )}
                </div>
              </div>

              {/* Expanded details */}
              {expandedId === hotspot.id && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  className="mt-4 pt-4 border-t border-dark-700"
                >
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                    <div>
                      <p className="text-xs text-dark-500 uppercase tracking-wider mb-1">Último Risco</p>
                      <p className="text-sm text-dark-200">{hotspot.last_risk_title || 'N/A'}</p>
                    </div>
                    <div>
                      <p className="text-xs text-dark-500 uppercase tracking-wider mb-1">Nível</p>
                      <span className={`inline-flex px-2 py-1 rounded text-xs font-medium ${
                        hotspot.last_risk_level === 'critical'
                          ? 'bg-red-500/20 text-red-400'
                          : hotspot.last_risk_level === 'high'
                          ? 'bg-orange-500/20 text-orange-400'
                          : hotspot.last_risk_level === 'medium'
                          ? 'bg-yellow-500/20 text-yellow-400'
                          : 'bg-green-500/20 text-green-400'
                      }`}>
                        {hotspot.last_risk_level}
                      </span>
                    </div>
                    <div>
                      <p className="text-xs text-dark-500 uppercase tracking-wider mb-1">Última Ocorrência</p>
                      <p className="text-sm text-dark-200">
                        {hotspot.last_risk_at 
                          ? formatDistanceToNow(new Date(hotspot.last_risk_at), { addSuffix: true, locale: ptBR })
                          : 'N/A'
                        }
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-dark-500 uppercase tracking-wider mb-1">Atualizado</p>
                      <p className="text-sm text-dark-200">
                        {formatDistanceToNow(new Date(hotspot.updated_at), { addSuffix: true, locale: ptBR })}
                      </p>
                    </div>
                  </div>

                  {/* Risk breakdown bar */}
                  <div className="mb-4">
                    <p className="text-xs text-dark-500 uppercase tracking-wider mb-2">Distribuição de Riscos</p>
                    <div className="h-3 rounded-full overflow-hidden bg-dark-700 flex">
                      {hotspot.critical_count > 0 && (
                        <div 
                          className="bg-red-500 h-full"
                          style={{ width: `${(hotspot.critical_count / hotspot.total_risks) * 100}%` }}
                          title={`${hotspot.critical_count} críticos`}
                        />
                      )}
                      {hotspot.high_count > 0 && (
                        <div 
                          className="bg-orange-500 h-full"
                          style={{ width: `${(hotspot.high_count / hotspot.total_risks) * 100}%` }}
                          title={`${hotspot.high_count} altos`}
                        />
                      )}
                      {hotspot.medium_count > 0 && (
                        <div 
                          className="bg-yellow-500 h-full"
                          style={{ width: `${(hotspot.medium_count / hotspot.total_risks) * 100}%` }}
                          title={`${hotspot.medium_count} médios`}
                        />
                      )}
                      {hotspot.low_count > 0 && (
                        <div 
                          className="bg-green-500 h-full"
                          style={{ width: `${(hotspot.low_count / hotspot.total_risks) * 100}%` }}
                          title={`${hotspot.low_count} baixos`}
                        />
                      )}
                    </div>
                    <div className="flex justify-between text-xs text-dark-500 mt-1">
                      <span className="flex items-center gap-1">
                        <span className="w-2 h-2 rounded-full bg-red-500" /> Crítico: {hotspot.critical_count}
                      </span>
                      <span className="flex items-center gap-1">
                        <span className="w-2 h-2 rounded-full bg-orange-500" /> Alto: {hotspot.high_count}
                      </span>
                      <span className="flex items-center gap-1">
                        <span className="w-2 h-2 rounded-full bg-yellow-500" /> Médio: {hotspot.medium_count}
                      </span>
                      <span className="flex items-center gap-1">
                        <span className="w-2 h-2 rounded-full bg-green-500" /> Baixo: {hotspot.low_count}
                      </span>
                    </div>
                  </div>
                </motion.div>
              )}
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
}

