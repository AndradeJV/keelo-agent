import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  FileText,
  Image,
  Upload,
  Send,
  Loader2,
  CheckCircle,
  AlertTriangle,
  Copy,
  X,
  ChevronDown,
  ChevronUp,
  Sparkles,
  Clock,
  ExternalLink,
} from 'lucide-react';
import { analyzeRequirements } from '../stores/api';
import { useRealtimeStore } from '../stores/realtime';
import RiskBadge from '../components/RiskBadge';

interface QueuedAnalysis {
  id: string;
  featureName: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  createdAt: Date;
}

export default function Requirements() {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<Record<string, unknown> | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [queuedAnalyses, setQueuedAnalyses] = useState<QueuedAnalysis[]>([]);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Requisitos textuais
  const [userStory, setUserStory] = useState('');
  const [acceptanceCriteria, setAcceptanceCriteria] = useState('');
  const [additionalContext, setAdditionalContext] = useState('');

  // Figma
  const [figmaImage, setFigmaImage] = useState<string | null>(null);
  const [figmaUrl, setFigmaUrl] = useState('');

  // PDF
  const [pdfContent, setPdfContent] = useState<string | null>(null);
  const [pdfName, setPdfName] = useState('');

  // Metadata
  const [projectName, setProjectName] = useState('');
  const [featureName, setFeatureName] = useState('');
  const [sprint, setSprint] = useState('');

  // UI State
  const [showAdvanced, setShowAdvanced] = useState(false);

  // Listen to realtime updates
  const realtimeAnalyses = useRealtimeStore((state) => state.analyses);

  // Update queued analyses status from realtime events
  useEffect(() => {
    setQueuedAnalyses(prev => 
      prev.map(qa => {
        const realtimeUpdate = realtimeAnalyses.find(ra => ra.id === qa.id);
        if (realtimeUpdate) {
          return {
            ...qa,
            status: realtimeUpdate.status as QueuedAnalysis['status'],
          };
        }
        return qa;
      })
    );
  }, [realtimeAnalyses]);

  // Check if has any input
  const hasInput = userStory || figmaImage || figmaUrl || pdfContent || additionalContext;

  // Count filled sections
  const filledSections = [
    userStory || acceptanceCriteria,
    figmaImage || figmaUrl,
    pdfContent,
    additionalContext,
  ].filter(Boolean).length;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    
    if (!hasInput) {
      setError('Preencha pelo menos um campo de requisito');
      return;
    }

    setLoading(true);
    setError(null);
    setSuccessMessage(null);

    try {
      // Build requirements text combining user story and acceptance criteria
      let requirements = '';
      if (userStory) {
        requirements += `## História de Usuário\n${userStory}\n\n`;
      }
      if (acceptanceCriteria) {
        requirements += `## Critérios de Aceite\n${acceptanceCriteria}\n\n`;
      }
      if (additionalContext) {
        requirements += `## Contexto Adicional\n${additionalContext}\n\n`;
      }

      const currentFeatureName = featureName || 'Análise de Requisitos';

      const response = await analyzeRequirements({
        figmaUrl: figmaUrl || undefined,
        figmaImage: figmaImage || undefined,
        pdfBase64: pdfContent || undefined,
        requirements: requirements || undefined,
        metadata: {
          projectName: projectName || undefined,
          featureName: featureName || undefined,
          sprint: sprint || undefined,
        },
      });

      // Check if async mode (pending/processing)
      if (response.status === 'pending' || response.status === 'processing') {
        // Add to queued analyses
        setQueuedAnalyses(prev => [
          {
            id: response.analysisId!,
            featureName: currentFeatureName,
            status: response.status as 'pending' | 'processing',
            createdAt: new Date(),
          },
          ...prev,
        ]);

        // Show success message
        setSuccessMessage(`"${currentFeatureName}" foi enfileirada para análise. Você pode continuar adicionando outras features.`);

        // Clear form for next submission
        clearFormFields();
      } else {
        // Sync mode - show result directly
        setResult(response.data as Record<string, unknown>);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro desconhecido');
    } finally {
      setLoading(false);
    }
  }

  function clearFormFields() {
    setUserStory('');
    setAcceptanceCriteria('');
    setAdditionalContext('');
    setFigmaImage(null);
    setFigmaUrl('');
    setPdfContent(null);
    setPdfName('');
    // Keep metadata (project, sprint) for batch submissions
  }

  function handleImageUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      setFigmaImage(reader.result as string);
    };
    reader.readAsDataURL(file);
  }

  function handlePdfUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setPdfName(file.name);
    const reader = new FileReader();
    reader.onload = () => {
      setPdfContent(reader.result as string);
    };
    reader.readAsDataURL(file);
  }

  function copyResult() {
    if (result) {
      navigator.clipboard.writeText(JSON.stringify(result, null, 2));
    }
  }

  function clearForm() {
    clearFormFields();
    setFeatureName('');
    setProjectName('');
    setSprint('');
    setResult(null);
    setError(null);
    setSuccessMessage(null);
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-dark-100 flex items-center gap-2">
            <Sparkles className="text-keelo-500" />
            Análise de Requisitos
          </h1>
          <p className="text-dark-400 mt-1">
            Gere cenários de teste antes do desenvolvimento combinando múltiplas fontes
          </p>
        </div>
        {hasInput && (
          <button
            onClick={clearForm}
            className="btn-ghost flex items-center gap-2 text-sm"
          >
            <X size={14} />
            Limpar
          </button>
        )}
      </div>

      {/* Success Message */}
      <AnimatePresence>
        {successMessage && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="flex items-center gap-3 p-4 bg-green-500/10 border border-green-500/30 rounded-lg"
          >
            <CheckCircle className="text-green-500 shrink-0" size={20} />
            <p className="text-green-400 flex-1">{successMessage}</p>
            <button
              onClick={() => setSuccessMessage(null)}
              className="text-green-400/60 hover:text-green-400"
            >
              <X size={16} />
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Queued Analyses */}
      {queuedAnalyses.length > 0 && (
        <div className="card">
          <div className="flex items-center gap-2 mb-3">
            <Clock className="text-keelo-500" size={18} />
            <h3 className="font-semibold text-dark-100">Análises em Andamento</h3>
            <span className="text-xs bg-keelo-500/20 text-keelo-400 px-2 py-0.5 rounded-full">
              {queuedAnalyses.filter(a => a.status === 'pending' || a.status === 'processing').length}
            </span>
          </div>
          <div className="space-y-2">
            {queuedAnalyses.map((analysis) => (
              <div
                key={analysis.id}
                className="flex items-center gap-3 p-3 rounded-lg bg-dark-800/50"
              >
                {analysis.status === 'pending' && (
                  <Clock className="text-yellow-500 shrink-0" size={16} />
                )}
                {analysis.status === 'processing' && (
                  <Loader2 className="text-blue-500 shrink-0 animate-spin" size={16} />
                )}
                {analysis.status === 'completed' && (
                  <CheckCircle className="text-green-500 shrink-0" size={16} />
                )}
                {analysis.status === 'failed' && (
                  <AlertTriangle className="text-red-500 shrink-0" size={16} />
                )}
                
                <span className="flex-1 text-dark-200 truncate">
                  {analysis.featureName}
                </span>
                
                <span className={`text-xs px-2 py-0.5 rounded ${
                  analysis.status === 'pending' ? 'bg-yellow-500/20 text-yellow-400' :
                  analysis.status === 'processing' ? 'bg-blue-500/20 text-blue-400' :
                  analysis.status === 'completed' ? 'bg-green-500/20 text-green-400' :
                  'bg-red-500/20 text-red-400'
                }`}>
                  {analysis.status === 'pending' && 'Na fila'}
                  {analysis.status === 'processing' && 'Analisando...'}
                  {analysis.status === 'completed' && 'Concluída'}
                  {analysis.status === 'failed' && 'Falhou'}
                </span>

                {analysis.status === 'completed' && (
                  <Link
                    to={`/analyses/${analysis.id}`}
                    className="text-keelo-400 hover:text-keelo-300"
                  >
                    <ExternalLink size={14} />
                  </Link>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Input Summary */}
      {filledSections > 0 && (
        <div className="flex items-center gap-4 p-4 bg-keelo-500/10 border border-keelo-500/30 rounded-lg">
          <div className="flex items-center gap-2">
            <CheckCircle className="w-5 h-5 text-keelo-500" />
            <span className="text-keelo-400 font-medium">
              {filledSections} fonte{filledSections > 1 ? 's' : ''} de requisitos
            </span>
          </div>
          <div className="flex gap-2 text-sm">
            {(userStory || acceptanceCriteria) && (
              <span className="px-2 py-1 bg-blue-500/20 text-blue-400 rounded">História</span>
            )}
            {(figmaImage || figmaUrl) && (
              <span className="px-2 py-1 bg-purple-500/20 text-purple-400 rounded">Figma</span>
            )}
            {pdfContent && (
              <span className="px-2 py-1 bg-orange-500/20 text-orange-400 rounded">PDF</span>
            )}
            {additionalContext && (
              <span className="px-2 py-1 bg-green-500/20 text-green-400 rounded">Contexto</span>
            )}
          </div>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Left Column - Text Inputs */}
          <div className="space-y-6">
            {/* User Story Section */}
            <div className="card">
              <div className="flex items-center gap-2 mb-4">
                <FileText className="text-blue-400" size={20} />
                <h3 className="font-medium text-dark-100">História de Usuário</h3>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-dark-300 mb-2">
                    História
                  </label>
                  <textarea
                    value={userStory}
                    onChange={(e) => setUserStory(e.target.value)}
                    placeholder="Como um [tipo de usuário], quero [objetivo] para [benefício]"
                    className="input min-h-[100px]"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-dark-300 mb-2">
                    Critérios de Aceite
                  </label>
                  <textarea
                    value={acceptanceCriteria}
                    onChange={(e) => setAcceptanceCriteria(e.target.value)}
                    placeholder="- Dado que [contexto]&#10;- Quando [ação]&#10;- Então [resultado esperado]"
                    className="input min-h-[100px]"
                  />
                </div>
              </div>
            </div>

            {/* Additional Context */}
            <div className="card">
              <div className="flex items-center gap-2 mb-4">
                <FileText className="text-green-400" size={20} />
                <h3 className="font-medium text-dark-100">Contexto Adicional</h3>
              </div>

              <textarea
                value={additionalContext}
                onChange={(e) => setAdditionalContext(e.target.value)}
                placeholder="Regras de negócio, restrições técnicas, integrações, fluxos relacionados..."
                className="input min-h-[120px]"
              />
            </div>
          </div>

          {/* Right Column - File Inputs */}
          <div className="space-y-6">
            {/* Figma Section */}
            <div className="card">
              <div className="flex items-center gap-2 mb-4">
                <Image className="text-purple-400" size={20} />
                <h3 className="font-medium text-dark-100">Design (Figma)</h3>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-dark-300 mb-2">
                    URL do Figma
                  </label>
                  <input
                    type="url"
                    value={figmaUrl}
                    onChange={(e) => setFigmaUrl(e.target.value)}
                    placeholder="https://www.figma.com/file/..."
                    className="input"
                  />
                </div>

                <div className="relative">
                  <label className="block text-sm font-medium text-dark-300 mb-2">
                    Ou faça upload de uma imagem
                  </label>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleImageUpload}
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                    style={{ top: '24px' }}
                  />
                  <div className={`border-2 border-dashed rounded-lg p-6 text-center transition-colors ${
                    figmaImage ? 'border-purple-500 bg-purple-500/10' : 'border-dark-700 hover:border-dark-600'
                  }`}>
                    {figmaImage ? (
                      <div className="flex items-center justify-center gap-3">
                        <CheckCircle className="w-6 h-6 text-purple-400" />
                        <span className="text-purple-400">Imagem carregada</span>
                        <button
                          type="button"
                          onClick={() => setFigmaImage(null)}
                          className="p-1 hover:bg-dark-700 rounded"
                        >
                          <X size={16} className="text-dark-400" />
                        </button>
                      </div>
                    ) : (
                      <div className="flex flex-col items-center gap-2">
                        <Image className="w-8 h-8 text-dark-500" />
                        <p className="text-dark-400 text-sm">Arraste ou clique para upload</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* PDF Section */}
            <div className="card">
              <div className="flex items-center gap-2 mb-4">
                <Upload className="text-orange-400" size={20} />
                <h3 className="font-medium text-dark-100">Documento PDF</h3>
              </div>

              <div className="relative">
                <input
                  type="file"
                  accept=".pdf"
                  onChange={handlePdfUpload}
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                />
                <div className={`border-2 border-dashed rounded-lg p-6 text-center transition-colors ${
                  pdfContent ? 'border-orange-500 bg-orange-500/10' : 'border-dark-700 hover:border-dark-600'
                }`}>
                  {pdfContent ? (
                    <div className="flex items-center justify-center gap-3">
                      <CheckCircle className="w-6 h-6 text-orange-400" />
                      <span className="text-orange-400 truncate max-w-[200px]">{pdfName}</span>
                      <button
                        type="button"
                        onClick={() => { setPdfContent(null); setPdfName(''); }}
                        className="p-1 hover:bg-dark-700 rounded"
                      >
                        <X size={16} className="text-dark-400" />
                      </button>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center gap-2">
                      <Upload className="w-8 h-8 text-dark-500" />
                      <p className="text-dark-400 text-sm">Arraste ou clique para upload</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Metadata (Advanced) */}
        <div className="card">
          <button
            type="button"
            onClick={() => setShowAdvanced(!showAdvanced)}
            className="flex items-center justify-between w-full"
          >
            <span className="font-medium text-dark-100">Metadados do Projeto</span>
            {showAdvanced ? (
              <ChevronUp className="text-dark-400" size={20} />
            ) : (
              <ChevronDown className="text-dark-400" size={20} />
            )}
          </button>

          <AnimatePresence>
            {showAdvanced && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="overflow-hidden"
              >
                <div className="grid grid-cols-3 gap-4 mt-4 pt-4 border-t border-dark-700">
                  <div>
                    <label className="block text-sm font-medium text-dark-300 mb-2">
                      Projeto
                    </label>
                    <input
                      type="text"
                      value={projectName}
                      onChange={(e) => setProjectName(e.target.value)}
                      placeholder="Nome do projeto"
                      className="input"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-dark-300 mb-2">
                      Feature
                    </label>
                    <input
                      type="text"
                      value={featureName}
                      onChange={(e) => setFeatureName(e.target.value)}
                      placeholder="Nome da feature"
                      className="input"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-dark-300 mb-2">
                      Sprint
                    </label>
                    <input
                      type="text"
                      value={sprint}
                      onChange={(e) => setSprint(e.target.value)}
                      placeholder="Sprint 10"
                      className="input"
                    />
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Error */}
        {error && (
          <div className="flex items-start gap-3 p-4 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400">
            <AlertTriangle className="w-5 h-5 flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-medium">Erro na análise</p>
              <p className="text-sm mt-1">{error}</p>
            </div>
          </div>
        )}

        {/* Submit */}
        <button
          type="submit"
          disabled={loading || !hasInput}
          className="w-full btn-primary flex items-center justify-center gap-2 py-4 text-lg disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading ? (
            <>
              <Loader2 className="w-5 h-5 animate-spin" />
              Analisando requisitos...
            </>
          ) : (
            <>
              <Send size={20} />
              Analisar Requisitos
            </>
          )}
        </button>
      </form>

      {/* Result */}
      <AnimatePresence>
        {result && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="card"
          >
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold text-dark-100 flex items-center gap-2">
                <CheckCircle className="text-green-500" />
                Análise Concluída
              </h2>
              <button
                onClick={copyResult}
                className="btn-ghost flex items-center gap-2 text-sm"
              >
                <Copy size={14} />
                Copiar JSON
              </button>
            </div>

            <ResultSummary data={result} />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function ResultSummary({ data }: { data: Record<string, unknown> }) {
  const summary = data.summary as Record<string, unknown> | undefined;
  const scenarios = data.scenarios as Array<{ id: string; title: string; category: string; priority: string }> | undefined;
  const criteria = data.acceptanceCriteria as string[] | undefined;
  const gaps = data.gaps as Array<{ title: string; severity: string }> | undefined;
  const risks = data.risks as Array<{ title: string; severity: string }> | undefined;

  return (
    <div className="space-y-6">
      {/* Summary */}
      {summary && (
        <div className="p-4 bg-gradient-to-r from-keelo-500/10 to-purple-500/10 border border-keelo-500/20 rounded-lg">
          <h3 className="font-semibold text-dark-100 text-lg">{summary.title as string}</h3>
          <p className="text-dark-300 mt-2">{summary.description as string}</p>
          <div className="flex gap-4 mt-4 text-sm">
            {summary.complexity != null && (
              <span className="px-2 py-1 bg-dark-800 rounded text-dark-300">
                Complexidade: <span className="text-dark-100">{String(summary.complexity)}</span>
              </span>
            )}
          </div>
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-4 gap-4">
        <div className="text-center p-4 bg-dark-800/50 rounded-lg">
          <p className="text-3xl font-bold text-keelo-400">{scenarios?.length || 0}</p>
          <p className="text-sm text-dark-400">Cenários</p>
        </div>
        <div className="text-center p-4 bg-dark-800/50 rounded-lg">
          <p className="text-3xl font-bold text-red-400">{risks?.length || 0}</p>
          <p className="text-sm text-dark-400">Riscos</p>
        </div>
        <div className="text-center p-4 bg-dark-800/50 rounded-lg">
          <p className="text-3xl font-bold text-blue-400">{criteria?.length || 0}</p>
          <p className="text-sm text-dark-400">Critérios</p>
        </div>
        <div className="text-center p-4 bg-dark-800/50 rounded-lg">
          <p className="text-3xl font-bold text-orange-400">{gaps?.length || 0}</p>
          <p className="text-sm text-dark-400">Gaps</p>
        </div>
      </div>

      {/* Risks */}
      {risks && risks.length > 0 && (
        <div>
          <h4 className="font-medium text-dark-200 mb-3 flex items-center gap-2">
            🚨 Riscos Identificados
          </h4>
          <div className="space-y-2">
            {risks.map((risk, i) => (
              <div key={i} className="flex items-center justify-between p-3 bg-dark-800/50 rounded-lg">
                <span className="text-dark-200">{risk.title}</span>
                <RiskBadge risk={risk.severity as 'critical' | 'high' | 'medium' | 'low'} />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Scenarios */}
      {scenarios && scenarios.length > 0 && (
        <div>
          <h4 className="font-medium text-dark-200 mb-3 flex items-center gap-2">
            📋 Cenários de Teste
          </h4>
          <div className="space-y-2 max-h-64 overflow-y-auto">
            {scenarios.map((s, i) => (
              <div key={i} className="flex items-center justify-between p-3 bg-dark-800/50 rounded-lg text-sm">
                <div className="flex items-center gap-3">
                  <span className="text-dark-500 font-mono">{s.id}</span>
                  <span className="text-dark-200">{s.title}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs px-2 py-0.5 bg-dark-700 rounded text-dark-400">
                    {s.category}
                  </span>
                  <RiskBadge risk={s.priority as 'critical' | 'high' | 'medium' | 'low'} size="sm" />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Acceptance Criteria */}
      {criteria && criteria.length > 0 && (
        <div>
          <h4 className="font-medium text-dark-200 mb-3 flex items-center gap-2">
            ✅ Critérios de Aceite
          </h4>
          <div className="space-y-2">
            {criteria.map((c, i) => (
              <div key={i} className="p-3 bg-dark-800/50 rounded-lg text-sm text-dark-300">
                {c}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Gaps */}
      {gaps && gaps.length > 0 && (
        <div>
          <h4 className="font-medium text-dark-200 mb-3 flex items-center gap-2">
            ❓ Gaps Identificados
          </h4>
          <div className="space-y-2">
            {gaps.map((gap, i) => (
              <div key={i} className="flex items-center justify-between p-3 bg-dark-800/50 rounded-lg">
                <span className="text-dark-200">{gap.title}</span>
                <RiskBadge risk={gap.severity as 'critical' | 'high' | 'medium' | 'low'} />
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
