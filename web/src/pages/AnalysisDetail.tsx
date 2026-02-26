import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  ArrowLeft,
  GitPullRequest,
  FileSearch,
  ExternalLink,
  CheckCircle,
  AlertTriangle,
  Clock,
  Activity,
  ThumbsUp,
  ThumbsDown,
  Copy,
  Check,
  Code,
  Wand2,
} from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { getAnalysisDetails, type Analysis } from '../stores/api';
import RiskBadge from '../components/RiskBadge';

interface Scenario {
  id: string;
  title: string;
  category: string;
  priority: string;
  steps: string[];
  expected_result: string;
}

interface Risk {
  title: string;
  severity: string;
  area?: string;
  description?: string;
  mitigation?: string;
  probability?: string;
  impact?: string;
  tests_required?: string[];
}

interface Gap {
  title: string;
  type?: 'missing_info' | 'ambiguity' | 'contradiction' | 'edge_case' | 'dangerous_assumption' | 'implicit_criterion' | 'unclear_behavior';
  question: string;
  recommendation?: string;
  risk_if_ignored?: string;
  severity?: string;
}

interface PlaywrightTest {
  name: string;
  description: string;
  code: string;
}

export default function AnalysisDetail() {
  const { id } = useParams<{ id: string }>();
  const [analysis, setAnalysis] = useState<Analysis | null>(null);
  const [scenarios, setScenarios] = useState<Scenario[]>([]);
  const [risks, setRisks] = useState<Risk[]>([]);
  const [gaps, setGaps] = useState<Gap[]>([]);
  const [playwrightTests, setPlaywrightTests] = useState<PlaywrightTest[]>([]);
  const [implementationPrompt, setImplementationPrompt] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'risks' | 'scenarios' | 'playwright' | 'gaps' | 'prompt'>('risks');
  const [copiedPrompt, setCopiedPrompt] = useState(false);

  useEffect(() => {
    if (id) loadDetails();
  }, [id]);

  async function loadDetails() {
    try {
      const response = await getAnalysisDetails(id!);
      setAnalysis(response.data.analysis);
      setScenarios(response.data.scenarios || []);
      setRisks(response.data.risks || []);
      setGaps(response.data.gaps || []);
      setPlaywrightTests(response.data.playwrightTests || []);
      setImplementationPrompt(response.data.implementationPrompt || '');
    } catch (error) {
      console.error('Failed to load analysis details:', error);
    } finally {
      setLoading(false);
    }
  }

  function copyPromptToClipboard() {
    navigator.clipboard.writeText(implementationPrompt);
    setCopiedPrompt(true);
    setTimeout(() => setCopiedPrompt(false), 2000);
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-4 border-keelo-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!analysis) {
    return (
      <div className="card text-center py-12">
        <AlertTriangle className="w-16 h-16 mx-auto text-dark-600 mb-4" />
        <h3 className="text-lg font-medium text-dark-300">Análise não encontrada</h3>
        <Link to="/analyses" className="text-keelo-500 hover:text-keelo-400 mt-4 inline-block">
          ← Voltar para análises
        </Link>
      </div>
    );
  }

  const statusConfig = {
    pending: { color: 'text-yellow-400', bg: 'bg-yellow-500/20', icon: Clock, label: 'Pendente' },
    processing: { color: 'text-blue-400', bg: 'bg-blue-500/20', icon: Activity, label: 'Processando' },
    completed: { color: 'text-green-400', bg: 'bg-green-500/20', icon: CheckCircle, label: 'Concluído' },
    failed: { color: 'text-red-400', bg: 'bg-red-500/20', icon: AlertTriangle, label: 'Falhou' },
  };

  const status = statusConfig[analysis.status] || statusConfig.pending;
  const StatusIcon = status.icon;

  return (
    <div className="space-y-6">
      {/* Back Link */}
      <Link
        to="/analyses"
        className="inline-flex items-center gap-2 text-dark-400 hover:text-dark-200 transition-colors"
      >
        <ArrowLeft size={16} />
        Voltar para análises
      </Link>

      {/* Header */}
      <div className="card">
        <div className="flex items-start gap-4">
          {/* Type Icon */}
          <div
            className={`w-14 h-14 rounded-xl flex items-center justify-center flex-shrink-0 ${
              analysis.type === 'pr'
                ? 'bg-blue-500/20 text-blue-400'
                : 'bg-purple-500/20 text-purple-400'
            }`}
          >
            {analysis.type === 'pr' ? (
              <GitPullRequest size={28} />
            ) : (
              <FileSearch size={28} />
            )}
          </div>

          {/* Info */}
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h1 className="text-xl font-bold text-dark-100">
                  {analysis.pr_title || analysis.feature_name || analysis.summary_title || 'Análise'}
                </h1>
                <p className="text-dark-400 mt-1">
                  {analysis.type === 'pr' && analysis.pr_number && (
                    <span className="text-blue-400">PR #{analysis.pr_number}</span>
                  )}
                  {analysis.project_name && <span> · {analysis.project_name}</span>}
                </p>
              </div>

              <div className="flex items-center gap-2">
                {analysis.overall_risk && <RiskBadge risk={analysis.overall_risk} size="md" />}
                <span className={`flex items-center gap-1 px-3 py-1 rounded-full text-sm ${status.bg} ${status.color}`}>
                  <StatusIcon size={14} />
                  {status.label}
                </span>
              </div>
            </div>

            {analysis.summary_description && (
              <p className="text-dark-300 mt-4">{analysis.summary_description}</p>
            )}

            {/* Meta */}
            <div className="flex items-center gap-6 mt-4 text-sm text-dark-400">
              <span>
                Criado em {format(new Date(analysis.created_at), "dd 'de' MMM, HH:mm", { locale: ptBR })}
              </span>
              {analysis.completed_at && (
                <span>
                  Concluído em {format(new Date(analysis.completed_at), "dd 'de' MMM, HH:mm", { locale: ptBR })}
                </span>
              )}
              {analysis.pr_url && (
                <a
                  href={analysis.pr_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1 text-keelo-500 hover:text-keelo-400"
                >
                  Ver no GitHub <ExternalLink size={14} />
                </a>
              )}
            </div>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-4 gap-4 mt-6 pt-6 border-t border-dark-700">
          <div className="text-center">
            <p className="text-2xl font-bold text-red-400">{analysis.risks_count}</p>
            <p className="text-sm text-dark-400">Riscos</p>
          </div>
          <div className="text-center">
            <p className="text-2xl font-bold text-dark-100">{analysis.scenarios_count}</p>
            <p className="text-sm text-dark-400">Cenários</p>
          </div>
          <div className="text-center">
            <p className="text-2xl font-bold text-purple-400">{playwrightTests.length}</p>
            <p className="text-sm text-dark-400">Testes Playwright</p>
          </div>
          <div className="text-center">
            <div className="flex items-center justify-center gap-2">
              <span className="flex items-center gap-1 text-green-400">
                <ThumbsUp size={16} /> {analysis.thumbs_up}
              </span>
              <span className="flex items-center gap-1 text-red-400">
                <ThumbsDown size={16} /> {analysis.thumbs_down}
              </span>
            </div>
            <p className="text-sm text-dark-400">Feedback</p>
          </div>
        </div>
      </div>

      {/* Tabs - Risks first! */}
      <div className="flex gap-2 border-b border-dark-800 pb-4 flex-wrap">
        {(['risks', 'scenarios', 'playwright', 'gaps'] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-2 rounded-lg font-medium transition-colors ${
              activeTab === tab
                ? 'bg-keelo-500/20 text-keelo-400 border border-keelo-500/30'
                : 'text-dark-400 hover:text-dark-200 hover:bg-dark-800'
            }`}
          >
            {tab === 'risks' && `🚨 Riscos (${risks.length})`}
            {tab === 'scenarios' && `📋 Cenários (${scenarios.length})`}
            {tab === 'playwright' && `🎭 Playwright (${playwrightTests.length})`}
            {tab === 'gaps' && `❓ Gaps (${gaps.length})`}
          </button>
        ))}
        
        {/* Show Implementation Prompt tab for requirements analyses */}
        {analysis?.type === 'requirements' && implementationPrompt && (
          <button
            onClick={() => setActiveTab('prompt')}
            className={`px-4 py-2 rounded-lg font-medium transition-colors flex items-center gap-2 ${
              activeTab === 'prompt'
                ? 'bg-purple-500/20 text-purple-400 border border-purple-500/30'
                : 'text-dark-400 hover:text-dark-200 hover:bg-dark-800'
            }`}
          >
            <Wand2 size={16} />
            Prompt de Implementação
          </button>
        )}
      </div>

      {/* Content */}
      <motion.div
        key={activeTab}
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.2 }}
      >
        {activeTab === 'risks' && (
          <div className="space-y-4">
            {risks.length === 0 ? (
              <div className="card text-center py-8 text-dark-400">
                <CheckCircle className="w-12 h-12 mx-auto mb-3 text-green-500" />
                <p>Nenhum risco identificado</p>
              </div>
            ) : (
              risks.map((risk, i) => (
                <RiskCard key={i} risk={risk} />
              ))
            )}
          </div>
        )}

        {activeTab === 'scenarios' && (
          <div className="space-y-4">
            {scenarios.map((scenario) => (
              <div key={scenario.id} className="card">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <h3 className="font-medium text-dark-100">{scenario.title}</h3>
                    <p className="text-sm text-dark-400 mt-1">
                      {scenario.category} · ID: {scenario.id}
                    </p>
                  </div>
                  {scenario.priority && (
                    <RiskBadge risk={scenario.priority as 'critical' | 'high' | 'medium' | 'low'} />
                  )}
                </div>

                {scenario.steps?.length > 0 && (
                  <div className="mt-4">
                    <p className="text-sm text-dark-400 mb-2">Passos:</p>
                    <ol className="list-decimal list-inside text-dark-300 space-y-1">
                      {scenario.steps.map((step, i) => (
                        <li key={i}>{step}</li>
                      ))}
                    </ol>
                  </div>
                )}

                {scenario.expected_result && (
                  <div className="mt-4 p-3 bg-dark-800/50 rounded-lg">
                    <p className="text-sm text-dark-400">Resultado Esperado:</p>
                    <p className="text-dark-200">{scenario.expected_result}</p>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {activeTab === 'playwright' && (
          <div className="space-y-4">
            {playwrightTests.length === 0 ? (
              <div className="card text-center py-8 text-dark-400">
                <Code className="w-12 h-12 mx-auto mb-3 opacity-50" />
                <p>Nenhum teste Playwright sugerido</p>
                <p className="text-sm mt-2">Os testes serão gerados na próxima análise</p>
              </div>
            ) : (
              playwrightTests.map((test, i) => (
                <PlaywrightTestCard key={i} test={test} />
              ))
            )}
          </div>
        )}

        {activeTab === 'gaps' && (
          <div className="space-y-4">
            {gaps.map((gap, i) => {
              const gapTypeConfig: Record<string, { icon: string; label: string; color: string }> = {
                missing_info: { icon: '📋', label: 'Info Faltando', color: 'bg-blue-500/20 text-blue-400' },
                ambiguity: { icon: '🔀', label: 'Ambiguidade', color: 'bg-yellow-500/20 text-yellow-400' },
                contradiction: { icon: '⚔️', label: 'Contradição', color: 'bg-red-500/20 text-red-400' },
                edge_case: { icon: '🔲', label: 'Caso de Borda', color: 'bg-purple-500/20 text-purple-400' },
                dangerous_assumption: { icon: '⚠️', label: 'Hipótese Perigosa', color: 'bg-orange-500/20 text-orange-400' },
                implicit_criterion: { icon: '📝', label: 'Critério Implícito', color: 'bg-cyan-500/20 text-cyan-400' },
                unclear_behavior: { icon: '❔', label: 'Comportamento Não Claro', color: 'bg-pink-500/20 text-pink-400' },
              };
              const config = gap.type ? gapTypeConfig[gap.type] : null;
              
              return (
                <div key={i} className="card">
                  <div className="flex items-start gap-3">
                    {config && (
                      <span className={`px-2 py-1 rounded text-xs font-medium ${config.color}`}>
                        {config.icon} {config.label}
                      </span>
                    )}
                    <div className="flex-1">
                      <h3 className="font-medium text-dark-100">{gap.title}</h3>
                      {gap.question && (
                        <p className="text-dark-400 mt-2">
                          💬 <span className="text-dark-300">{gap.question}</span>
                        </p>
                      )}
                      {gap.recommendation && (
                        <p className="text-dark-400 mt-2">
                          💡 <span className="text-dark-300">{gap.recommendation}</span>
                        </p>
                      )}
                      {gap.risk_if_ignored && (
                        <p className="text-red-400/80 mt-2 text-sm">
                          ⚠️ Se ignorado: {gap.risk_if_ignored}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {activeTab === 'prompt' && (
          <div className="space-y-4">
            <div className="card bg-gradient-to-br from-purple-500/10 to-dark-800 border-purple-500/30">
              <div className="flex items-start justify-between gap-4 mb-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-purple-500/20 flex items-center justify-center">
                    <Wand2 className="text-purple-400" size={20} />
                  </div>
                  <div>
                    <h3 className="font-semibold text-dark-100">Prompt de Implementação</h3>
                    <p className="text-sm text-dark-400">
                      Use este prompt para guiar a implementação dos cenários e riscos
                    </p>
                  </div>
                </div>
                <button
                  onClick={copyPromptToClipboard}
                  className="flex items-center gap-2 px-3 py-2 rounded-lg bg-purple-500/20 hover:bg-purple-500/30 text-purple-400 transition-colors"
                >
                  {copiedPrompt ? (
                    <>
                      <Check size={16} />
                      Copiado!
                    </>
                  ) : (
                    <>
                      <Copy size={16} />
                      Copiar Prompt
                    </>
                  )}
                </button>
              </div>

              <div className="bg-dark-900/80 rounded-lg p-4 max-h-[600px] overflow-y-auto">
                <pre className="text-sm text-dark-200 whitespace-pre-wrap font-mono">
                  {implementationPrompt}
                </pre>
              </div>

              <div className="mt-4 p-3 bg-dark-800/50 rounded-lg">
                <p className="text-sm text-dark-400">
                  💡 <strong>Dica:</strong> Copie este prompt e cole em seu assistente de IA favorito 
                  (ChatGPT, Claude, Cursor, etc.) para gerar os testes automaticamente.
                </p>
              </div>
            </div>
          </div>
        )}
      </motion.div>
    </div>
  );
}

function RiskCard({ risk }: { risk: Risk }) {
  return (
    <div className="card border-l-4 border-l-red-500">
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1">
          <h3 className="font-medium text-dark-100">{risk.title}</h3>
          {risk.area && (
            <p className="text-sm text-dark-400 mt-1">📍 Área: {risk.area}</p>
          )}
        </div>
        {risk.severity && (
          <RiskBadge risk={risk.severity as 'critical' | 'high' | 'medium' | 'low'} />
        )}
      </div>

      {risk.description && (
        <p className="text-dark-300 mt-3">{risk.description}</p>
      )}

      <div className="grid grid-cols-2 gap-4 mt-4">
        {risk.probability && (
          <div className="p-3 bg-dark-800/50 rounded-lg">
            <p className="text-xs text-dark-500 uppercase">Probabilidade</p>
            <p className="text-dark-200">{risk.probability}</p>
          </div>
        )}
        {risk.impact && (
          <div className="p-3 bg-dark-800/50 rounded-lg">
            <p className="text-xs text-dark-500 uppercase">Impacto</p>
            <p className="text-dark-200">{risk.impact}</p>
          </div>
        )}
      </div>

      {risk.mitigation && (
        <div className="mt-4 p-3 bg-green-500/10 border border-green-500/20 rounded-lg">
          <p className="text-xs text-green-400 uppercase mb-1">🛡️ Mitigação</p>
          <p className="text-dark-200">{risk.mitigation}</p>
        </div>
      )}

      {risk.tests_required && risk.tests_required.length > 0 && (
        <div className="mt-4">
          <p className="text-xs text-dark-500 uppercase mb-2">🧪 Testes Necessários</p>
          <ul className="list-disc list-inside text-dark-300 text-sm space-y-1">
            {risk.tests_required.map((test, i) => (
              <li key={i}>{test}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function PlaywrightTestCard({ test }: { test: PlaywrightTest }) {
  const [copied, setCopied] = useState(false);

  const copyCode = async () => {
    await navigator.clipboard.writeText(test.code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="card">
      <div className="flex items-start justify-between gap-4 mb-3">
        <div>
          <h3 className="font-medium text-dark-100 flex items-center gap-2">
            <span className="text-purple-400">🎭</span>
            {test.name}
          </h3>
          <p className="text-sm text-dark-400 mt-1">{test.description}</p>
        </div>
        <button
          onClick={copyCode}
          className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-sm transition-colors ${
            copied
              ? 'bg-green-500/20 text-green-400'
              : 'bg-dark-700 text-dark-300 hover:bg-dark-600 hover:text-dark-100'
          }`}
        >
          {copied ? (
            <>
              <Check size={14} />
              Copiado!
            </>
          ) : (
            <>
              <Copy size={14} />
              Copiar
            </>
          )}
        </button>
      </div>

      <div className="relative">
        <pre className="bg-dark-950 rounded-lg p-4 overflow-x-auto text-sm">
          <code className="text-dark-200 font-mono whitespace-pre">{test.code}</code>
        </pre>
      </div>
    </div>
  );
}
