import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import {
  Briefcase,
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  CheckCircle,
  Shield,
  Target,
  Send,
  RefreshCw,
  BarChart3,
  XCircle,
  Frown,
  Meh,
  Lightbulb,
  Clock,
  ArrowRight,
  Copy,
} from 'lucide-react';
import {
  getProductInsightsAggregate,
  getAnalyses,
  getProductImpactReport,
  getProductImpactMarkdown,
  sendProductImpactToSlack,
  type ProductInsightsAggregate,
  type ProductImpactReport,
  type Analysis,
} from '../stores/api';

type Period = 7 | 14 | 30;

export default function ProductInsights() {
  const [period, setPeriod] = useState<Period>(30);
  const [loading, setLoading] = useState(true);
  const [insights, setInsights] = useState<ProductInsightsAggregate | null>(null);
  const [recentAnalyses, setRecentAnalyses] = useState<Analysis[]>([]);
  const [selectedReport, setSelectedReport] = useState<ProductImpactReport | null>(null);
  const [selectedAnalysisId, setSelectedAnalysisId] = useState<string | null>(null);
  const [loadingReport, setLoadingReport] = useState(false);
  const [sendingSlack, setSendingSlack] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copiedMarkdown, setCopiedMarkdown] = useState(false);

  useEffect(() => {
    loadData();
  }, [period]);

  async function loadData() {
    setLoading(true);
    setError(null);
    try {
      const [insightsRes, analysesRes] = await Promise.all([
        getProductInsightsAggregate(period).catch(() => null),
        getAnalyses({ limit: 10 }),
      ]);

      if (insightsRes?.success) {
        setInsights(insightsRes.data);
      }
      if (analysesRes?.success) {
        setRecentAnalyses(analysesRes.data);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao carregar dados');
    } finally {
      setLoading(false);
    }
  }

  async function loadReport(analysisId: string) {
    setLoadingReport(true);
    setSelectedAnalysisId(analysisId);
    try {
      const res = await getProductImpactReport(analysisId);
      if (res.success) {
        setSelectedReport(res.data);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao carregar relatório');
    } finally {
      setLoadingReport(false);
    }
  }

  async function handleSendSlack() {
    if (!selectedAnalysisId) return;
    setSendingSlack(true);
    try {
      await sendProductImpactToSlack(selectedAnalysisId);
    } catch {
      // silently fail
    } finally {
      setSendingSlack(false);
    }
  }

  async function handleCopyMarkdown() {
    if (!selectedAnalysisId) return;
    try {
      const markdown = await getProductImpactMarkdown(selectedAnalysisId);
      await navigator.clipboard.writeText(markdown);
      setCopiedMarkdown(true);
      setTimeout(() => setCopiedMarkdown(false), 2000);
    } catch {
      // silently fail
    }
  }

  const healthEmoji: Record<string, string> = {
    healthy: '💚',
    attention: '💛',
    degraded: '🧡',
    critical: '❤️',
  };

  const severityConfig: Record<string, { icon: React.ReactNode; color: string; label: string }> = {
    blocking: { icon: <XCircle className="w-4 h-4" />, color: 'text-red-400', label: 'Bloqueante' },
    frustrating: { icon: <Frown className="w-4 h-4" />, color: 'text-orange-400', label: 'Frustrante' },
    annoying: { icon: <Meh className="w-4 h-4" />, color: 'text-yellow-400', label: 'Incômodo' },
    minor: { icon: <Lightbulb className="w-4 h-4" />, color: 'text-blue-400', label: 'Menor' },
  };

  const urgencyConfig: Record<string, { color: string; label: string }> = {
    immediate: { color: 'bg-red-500/20 text-red-400 border-red-500/30', label: 'Imediata' },
    'short-term': { color: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30', label: 'Curto prazo' },
    'long-term': { color: 'bg-green-500/20 text-green-400 border-green-500/30', label: 'Longo prazo' },
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-keelo-500 border-t-transparent rounded-full animate-spin" />
          <p className="text-dark-400">Carregando insights de produto...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-3">
            <Briefcase className="w-7 h-7 text-keelo-400" />
            Insights de Produto
          </h1>
          <p className="text-dark-400 mt-1">
            Qualidade traduzida em impacto de produto — para PM/CTO
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex bg-dark-800 rounded-lg p-1">
            {([7, 14, 30] as Period[]).map(p => (
              <button
                key={p}
                onClick={() => setPeriod(p)}
                className={`px-3 py-1.5 text-sm rounded-md transition-colors ${
                  period === p
                    ? 'bg-keelo-500 text-white'
                    : 'text-dark-400 hover:text-white'
                }`}
              >
                {p}d
              </button>
            ))}
          </div>
          <button
            onClick={loadData}
            className="p-2 text-dark-400 hover:text-white transition-colors"
          >
            <RefreshCw className="w-5 h-5" />
          </button>
        </div>
      </div>

      {error && (
        <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4">
          <p className="text-red-400">{error}</p>
        </div>
      )}

      {/* Summary Cards */}
      {insights && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Health Trend */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-dark-900 border border-dark-700 rounded-xl p-5"
          >
            <div className="flex items-center justify-between mb-3">
              <span className="text-dark-400 text-sm">Tendência</span>
              {insights.healthTrend === 'melhorando' ? (
                <TrendingUp className="w-5 h-5 text-green-400" />
              ) : insights.healthTrend === 'degradando' ? (
                <TrendingDown className="w-5 h-5 text-red-400" />
              ) : (
                <BarChart3 className="w-5 h-5 text-blue-400" />
              )}
            </div>
            <p className="text-2xl font-bold text-white capitalize">{insights.healthTrend}</p>
            <p className="text-dark-500 text-sm mt-1">
              {insights.totalAnalyses} análises no período
            </p>
          </motion.div>

          {/* Merge Decisions */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="bg-dark-900 border border-dark-700 rounded-xl p-5"
          >
            <div className="flex items-center justify-between mb-3">
              <span className="text-dark-400 text-sm">Decisões de Merge</span>
              <Shield className="w-5 h-5 text-keelo-400" />
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-bold text-green-400">{insights.mergeDecisions.approved}</span>
              <span className="text-dark-500">OK</span>
              <span className="text-xl font-bold text-yellow-400 ml-2">{insights.mergeDecisions.attention}</span>
              <span className="text-dark-500">Atenção</span>
              <span className="text-xl font-bold text-red-400 ml-2">{insights.mergeDecisions.blocked}</span>
              <span className="text-dark-500">Bloq</span>
            </div>
          </motion.div>

          {/* Critical Risks */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="bg-dark-900 border border-dark-700 rounded-xl p-5"
          >
            <div className="flex items-center justify-between mb-3">
              <span className="text-dark-400 text-sm">Riscos Identificados</span>
              <AlertTriangle className="w-5 h-5 text-orange-400" />
            </div>
            <p className="text-2xl font-bold text-white">{insights.summary.totalRisks}</p>
            <div className="flex gap-3 mt-1">
              <span className="text-red-400 text-sm">{insights.summary.criticalRisks} críticos</span>
              <span className="text-orange-400 text-sm">{insights.summary.highRisks} altos</span>
            </div>
          </motion.div>

          {/* Scenarios */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="bg-dark-900 border border-dark-700 rounded-xl p-5"
          >
            <div className="flex items-center justify-between mb-3">
              <span className="text-dark-400 text-sm">Cenários de Teste</span>
              <Target className="w-5 h-5 text-keelo-400" />
            </div>
            <p className="text-2xl font-bold text-white">{insights.summary.totalScenarios}</p>
            <p className="text-dark-500 text-sm mt-1">
              {insights.summary.totalGaps} gaps encontrados
            </p>
          </motion.div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: Top Risk Areas + Recent Impacts */}
        <div className="lg:col-span-1 space-y-6">
          {/* Top Risk Areas */}
          {insights && insights.topRiskAreas.length > 0 && (
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              className="bg-dark-900 border border-dark-700 rounded-xl p-5"
            >
              <h3 className="text-white font-semibold mb-4 flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-orange-400" />
                Áreas com Mais Riscos
              </h3>
              <div className="space-y-3">
                {insights.topRiskAreas.slice(0, 8).map((area, i) => (
                  <div key={i} className="flex items-center justify-between">
                    <span className="text-dark-300 text-sm">{area.area}</span>
                    <div className="flex items-center gap-2">
                      <div className="h-2 bg-dark-700 rounded-full w-20 overflow-hidden">
                        <div
                          className="h-full bg-orange-500 rounded-full"
                          style={{
                            width: `${Math.min(100, (area.count / (insights.topRiskAreas[0]?.count || 1)) * 100)}%`,
                          }}
                        />
                      </div>
                      <span className="text-dark-400 text-sm w-6 text-right">{area.count}</span>
                    </div>
                  </div>
                ))}
              </div>
            </motion.div>
          )}

          {/* Recent High-Impact PRs */}
          {insights && insights.recentImpacts.length > 0 && (
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.1 }}
              className="bg-dark-900 border border-dark-700 rounded-xl p-5"
            >
              <h3 className="text-white font-semibold mb-4 flex items-center gap-2">
                <Clock className="w-5 h-5 text-red-400" />
                Impactos Recentes
              </h3>
              <div className="space-y-3">
                {insights.recentImpacts.slice(0, 5).map((impact, i) => (
                  <div key={i} className="flex items-start gap-3 p-2 rounded-lg hover:bg-dark-800 transition-colors">
                    <span className={`mt-0.5 ${impact.riskLevel === 'critical' ? 'text-red-400' : 'text-orange-400'}`}>
                      {impact.riskLevel === 'critical' ? '🔴' : '🟠'}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="text-dark-200 text-sm truncate">{impact.title}</p>
                      <p className="text-dark-500 text-xs">
                        {impact.repository && `${impact.repository} `}
                        {impact.prNumber && `PR #${impact.prNumber}`}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </motion.div>
          )}

          {/* Select analysis for detailed report */}
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.2 }}
            className="bg-dark-900 border border-dark-700 rounded-xl p-5"
          >
            <h3 className="text-white font-semibold mb-4 flex items-center gap-2">
              <Briefcase className="w-5 h-5 text-keelo-400" />
              Gerar Relatório
            </h3>
            <p className="text-dark-400 text-sm mb-3">
              Selecione uma análise para gerar um relatório de impacto no produto
            </p>
            <div className="space-y-2">
              {recentAnalyses.filter(a => a.status === 'completed').slice(0, 6).map(analysis => (
                <button
                  key={analysis.id}
                  onClick={() => loadReport(analysis.id)}
                  className={`w-full text-left p-3 rounded-lg border transition-all ${
                    selectedAnalysisId === analysis.id
                      ? 'border-keelo-500 bg-keelo-500/10'
                      : 'border-dark-700 hover:border-dark-600 bg-dark-800'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-dark-200 text-sm truncate flex-1">
                      {analysis.pr_title || analysis.feature_name || 'Análise'}
                    </span>
                    <ArrowRight className="w-4 h-4 text-dark-500 flex-shrink-0 ml-2" />
                  </div>
                  <div className="flex items-center gap-2 mt-1">
                    {analysis.overall_risk && (
                      <span className={`text-xs px-1.5 py-0.5 rounded ${
                        analysis.overall_risk === 'critical' ? 'bg-red-500/20 text-red-400' :
                        analysis.overall_risk === 'high' ? 'bg-orange-500/20 text-orange-400' :
                        analysis.overall_risk === 'medium' ? 'bg-yellow-500/20 text-yellow-400' :
                        'bg-green-500/20 text-green-400'
                      }`}>
                        {analysis.overall_risk}
                      </span>
                    )}
                    <span className="text-dark-500 text-xs">
                      {analysis.pr_number ? `PR #${analysis.pr_number}` : analysis.type}
                    </span>
                  </div>
                </button>
              ))}
            </div>
          </motion.div>
        </div>

        {/* Right: Product Impact Report Detail */}
        <div className="lg:col-span-2">
          {loadingReport ? (
            <div className="bg-dark-900 border border-dark-700 rounded-xl p-12 flex items-center justify-center">
              <div className="flex flex-col items-center gap-4">
                <div className="w-10 h-10 border-4 border-keelo-500 border-t-transparent rounded-full animate-spin" />
                <p className="text-dark-400">Gerando relatório de impacto...</p>
              </div>
            </div>
          ) : selectedReport ? (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="space-y-5"
            >
              {/* Report Header */}
              <div className="bg-dark-900 border border-dark-700 rounded-xl p-6">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-xl font-bold text-white flex items-center gap-2">
                    📊 Relatório de Impacto no Produto
                  </h2>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={handleCopyMarkdown}
                      className="flex items-center gap-2 px-3 py-1.5 bg-dark-800 hover:bg-dark-700 rounded-lg text-sm text-dark-300 transition-colors"
                    >
                      {copiedMarkdown ? <CheckCircle className="w-4 h-4 text-green-400" /> : <Copy className="w-4 h-4" />}
                      {copiedMarkdown ? 'Copiado!' : 'Copiar MD'}
                    </button>
                    <button
                      onClick={handleSendSlack}
                      disabled={sendingSlack}
                      className="flex items-center gap-2 px-3 py-1.5 bg-[#4A154B] hover:bg-[#5D1A5E] rounded-lg text-sm text-white transition-colors disabled:opacity-50"
                    >
                      <Send className="w-4 h-4" />
                      {sendingSlack ? 'Enviando...' : 'Enviar Slack'}
                    </button>
                  </div>
                </div>

                {/* Merge Decision Banner */}
                <div className={`rounded-lg p-4 mb-4 ${
                  selectedReport.mergeDecision.recommendation === 'block' ? 'bg-red-500/10 border border-red-500/30' :
                  selectedReport.mergeDecision.recommendation === 'attention' ? 'bg-yellow-500/10 border border-yellow-500/30' :
                  'bg-green-500/10 border border-green-500/30'
                }`}>
                  <div className="flex items-center gap-3">
                    <span className="text-2xl">{selectedReport.mergeDecision.emoji}</span>
                    <div>
                      <p className="text-white font-semibold">{selectedReport.mergeDecision.label}</p>
                      <p className="text-dark-300 text-sm">{selectedReport.mergeDecision.reason}</p>
                    </div>
                  </div>
                </div>

                {/* Health + Summary */}
                <div className="grid grid-cols-2 gap-4 mb-4">
                  <div className="bg-dark-800 rounded-lg p-4">
                    <p className="text-dark-400 text-sm mb-1">Saúde do Produto</p>
                    <div className="flex items-center gap-2">
                      <span className="text-2xl">{healthEmoji[selectedReport.productHealth.status]}</span>
                      <span className="text-3xl font-bold text-white">{selectedReport.productHealth.score}</span>
                      <span className="text-dark-500">/100</span>
                    </div>
                    <p className="text-dark-500 text-sm mt-1">
                      Tendência: {selectedReport.productHealth.trend}
                    </p>
                  </div>
                  <div className="bg-dark-800 rounded-lg p-4">
                    <p className="text-dark-400 text-sm mb-1">Métricas</p>
                    <div className="grid grid-cols-2 gap-2 text-sm">
                      <div>
                        <span className="text-dark-500">Riscos: </span>
                        <span className="text-white font-medium">{selectedReport.metricsSummary.totalRisks}</span>
                      </div>
                      <div>
                        <span className="text-dark-500">Críticos: </span>
                        <span className="text-red-400 font-medium">{selectedReport.metricsSummary.criticalRisks}</span>
                      </div>
                      <div>
                        <span className="text-dark-500">UX: </span>
                        <span className="text-white font-medium">{selectedReport.metricsSummary.uxIssues}</span>
                      </div>
                      <div>
                        <span className="text-dark-500">Cenários: </span>
                        <span className="text-white font-medium">{selectedReport.metricsSummary.testScenarios}</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Executive Summary */}
                <div className="bg-dark-800 rounded-lg p-4">
                  <p className="text-dark-400 text-sm mb-2 flex items-center gap-1">
                    📋 Resumo Executivo
                  </p>
                  <p className="text-dark-200">{selectedReport.executiveSummary}</p>
                </div>
              </div>

              {/* UX Impact */}
              {selectedReport.uxImpact.length > 0 && (
                <div className="bg-dark-900 border border-dark-700 rounded-xl p-6">
                  <h3 className="text-white font-semibold mb-4 flex items-center gap-2">
                    🎨 Impacto na Experiência do Usuário
                  </h3>
                  <div className="space-y-3">
                    {selectedReport.uxImpact.map((impact, i) => {
                      const config = severityConfig[impact.severity] || severityConfig.minor;
                      return (
                        <div key={i} className="bg-dark-800 rounded-lg p-4 border border-dark-700">
                          <div className="flex items-start justify-between mb-2">
                            <div className="flex items-center gap-2">
                              <span className={config.color}>{config.icon}</span>
                              <span className="text-white font-medium">{impact.area}</span>
                              <span className={`text-xs px-1.5 py-0.5 rounded ${config.color} bg-dark-700`}>
                                {config.label}
                              </span>
                            </div>
                            {impact.metric && (
                              <span className="text-orange-400 text-sm bg-orange-500/10 px-2 py-0.5 rounded">
                                {impact.metric}
                              </span>
                            )}
                          </div>
                          <p className="text-dark-300 text-sm mb-1">{impact.issue}</p>
                          <p className="text-dark-400 text-sm italic">{impact.userImpact}</p>
                          {impact.affectedJourneys.length > 0 && (
                            <div className="flex gap-2 mt-2">
                              {impact.affectedJourneys.map((j, idx) => (
                                <span key={idx} className="text-xs bg-dark-700 text-dark-400 px-2 py-0.5 rounded">
                                  {j}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Business Risks */}
              {selectedReport.businessRisks.length > 0 && (
                <div className="bg-dark-900 border border-dark-700 rounded-xl p-6">
                  <h3 className="text-white font-semibold mb-4 flex items-center gap-2">
                    💼 Riscos de Negócio
                  </h3>
                  <div className="space-y-3">
                    {selectedReport.businessRisks.map((risk, i) => {
                      const urg = urgencyConfig[risk.urgency] || urgencyConfig['long-term'];
                      return (
                        <div key={i} className="bg-dark-800 rounded-lg p-4 border border-dark-700">
                          <div className="flex items-center justify-between mb-2">
                            <span className="text-white font-medium">{risk.title}</span>
                            <span className={`text-xs px-2 py-0.5 rounded border ${urg.color}`}>
                              {urg.label}
                            </span>
                          </div>
                          <p className="text-dark-300 text-sm mb-2">{risk.businessImpact}</p>
                          <div className="flex items-center gap-2">
                            <span className="text-dark-500 text-sm">Ação:</span>
                            <span className="text-keelo-400 text-sm">{risk.actionRequired}</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Recommendations */}
              {selectedReport.recommendations.length > 0 && (
                <div className="bg-dark-900 border border-dark-700 rounded-xl p-6">
                  <h3 className="text-white font-semibold mb-4 flex items-center gap-2">
                    ✅ Recomendações
                  </h3>
                  <div className="space-y-3">
                    {selectedReport.recommendations.map((rec, i) => {
                      const priorityConfig: Record<string, { dot: string; label: string }> = {
                        'must-do': { dot: 'bg-red-500', label: 'Obrigatório' },
                        'should-do': { dot: 'bg-yellow-500', label: 'Recomendado' },
                        'nice-to-have': { dot: 'bg-green-500', label: 'Desejável' },
                      };
                      const pConfig = priorityConfig[rec.priority] || priorityConfig['nice-to-have'];
                      
                      return (
                        <div key={i} className="bg-dark-800 rounded-lg p-4 border border-dark-700">
                          <div className="flex items-center gap-3 mb-2">
                            <div className={`w-2.5 h-2.5 rounded-full ${pConfig.dot}`} />
                            <span className="text-white font-medium">{rec.title}</span>
                            <span className="text-dark-500 text-xs px-1.5 py-0.5 bg-dark-700 rounded">
                              {pConfig.label}
                            </span>
                            <span className="text-dark-500 text-xs px-1.5 py-0.5 bg-dark-700 rounded ml-auto">
                              Esforço: {rec.effort}
                            </span>
                          </div>
                          <p className="text-dark-300 text-sm mb-1">{rec.description}</p>
                          <p className="text-dark-500 text-sm">
                            <span className="text-dark-400">Resultado esperado:</span> {rec.expectedOutcome}
                          </p>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </motion.div>
          ) : (
            <div className="bg-dark-900 border border-dark-700 rounded-xl p-12 flex flex-col items-center justify-center text-center">
              <Briefcase className="w-16 h-16 text-dark-700 mb-4" />
              <h3 className="text-white text-lg font-semibold mb-2">
                Selecione uma análise
              </h3>
              <p className="text-dark-400 max-w-md">
                Escolha uma análise na lista à esquerda para gerar um relatório de impacto no produto.
                O relatório traduz riscos técnicos em linguagem de negócio para PM/CTO.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

