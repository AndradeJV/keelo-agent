import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { 
  Settings as SettingsIcon, 
  Save, 
  RotateCcw, 
  Bot, 
  Bell, 
  Shield, 
  Check,
  AlertTriangle,
  Loader2,
  Sparkles,
  GitBranch,
  MessageSquare,
} from 'lucide-react';
import { 
  getSettings, 
  getSettingsOptions, 
  updateSettings, 
  resetSettings,
  type KeeloConfig,
  type ConfigOptions
} from '../stores/api';

export default function Settings() {
  const [config, setConfig] = useState<KeeloConfig | null>(null);
  const [options, setOptions] = useState<ConfigOptions | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    try {
      setLoading(true);
      const [configRes, optionsRes] = await Promise.all([
        getSettings(),
        getSettingsOptions(),
      ]);
      
      if (configRes.success) setConfig(configRes.data);
      if (optionsRes.success) setOptions(optionsRes.data);
    } catch (err) {
      setError('Falha ao carregar configurações');
    } finally {
      setLoading(false);
    }
  }

  async function handleSave() {
    if (!config) return;
    
    try {
      setSaving(true);
      setError(null);
      setSuccess(null);
      
      const res = await updateSettings(config);
      
      if (res.success) {
        setSuccess('Configurações salvas com sucesso!');
        setTimeout(() => setSuccess(null), 3000);
      } else {
        setError('Falha ao salvar configurações');
      }
    } catch (err) {
      setError('Erro ao salvar configurações');
    } finally {
      setSaving(false);
    }
  }

  async function handleReset() {
    if (!confirm('Tem certeza que deseja restaurar as configurações padrão?')) return;
    
    try {
      setSaving(true);
      const res = await resetSettings();
      
      if (res.success) {
        setConfig(res.data);
        setSuccess('Configurações restauradas!');
        setTimeout(() => setSuccess(null), 3000);
      }
    } catch (err) {
      setError('Erro ao resetar configurações');
    } finally {
      setSaving(false);
    }
  }

  function updateConfig<K extends keyof KeeloConfig>(key: K, value: KeeloConfig[K]) {
    if (!config) return;
    setConfig({ ...config, [key]: value });
  }

  function updateNestedConfig<K extends keyof KeeloConfig>(
    key: K, 
    nestedKey: string, 
    value: unknown
  ) {
    if (!config) return;
    setConfig({
      ...config,
      [key]: {
        ...(config[key] as object),
        [nestedKey]: value,
      },
    });
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-keelo-500" />
      </div>
    );
  }

  if (!config || !options) {
    return (
      <div className="p-4 bg-red-500/10 border border-red-500/30 rounded-lg flex items-center gap-3">
        <AlertTriangle className="w-5 h-5 text-red-500" />
        <p className="text-red-400">Erro ao carregar configurações</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 bg-gradient-to-br from-keelo-500 to-keelo-600 rounded-xl flex items-center justify-center shadow-lg shadow-keelo-500/20">
            <SettingsIcon className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-dark-100">Configurações</h1>
            <p className="text-dark-400 text-sm">Gerencie as configurações do Keelo</p>
          </div>
        </div>
        
        <div className="flex gap-3">
          <button
            onClick={handleReset}
            disabled={saving}
            className="flex items-center gap-2 px-4 py-2.5 bg-dark-800 hover:bg-dark-700 border border-dark-700 text-dark-300 hover:text-dark-100 rounded-lg transition-all"
          >
            <RotateCcw className="w-4 h-4" />
            <span className="hidden sm:inline">Restaurar</span>
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-keelo-500 to-keelo-600 hover:from-keelo-600 hover:to-keelo-700 text-white font-medium rounded-lg transition-all shadow-lg shadow-keelo-500/20"
          >
            {saving ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Save className="w-4 h-4" />
            )}
            Salvar
          </button>
        </div>
      </div>

      {/* Messages */}
      {error && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="p-4 bg-red-500/10 border border-red-500/30 rounded-lg flex items-center gap-3"
        >
          <AlertTriangle className="w-5 h-5 text-red-500" />
          <p className="text-red-400">{error}</p>
        </motion.div>
      )}
      
      {success && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="p-4 bg-green-500/10 border border-green-500/30 rounded-lg flex items-center gap-3"
        >
          <Check className="w-5 h-5 text-green-500" />
          <p className="text-green-400">{success}</p>
        </motion.div>
      )}

      {/* Sections - Full Width Layout */}
      <div className="space-y-4">
        {/* General */}
        <Section
          title="Geral"
          icon={<Sparkles className="w-5 h-5" />}
          color="keelo"
        >
          <div className="space-y-4">
            <SelectField
              label="Idioma"
              value={config.language}
              options={options.language}
              onChange={(v) => updateConfig('language', v)}
            />
            <SelectField
              label="Modo de Trigger"
              value={config.trigger}
              options={options.trigger}
              onChange={(v) => updateConfig('trigger', v)}
              help="Como o Keelo é acionado nos PRs"
            />
          </div>
        </Section>

        {/* LLM */}
        <Section
          title="Modelo de IA"
          icon={<Bot className="w-5 h-5" />}
          color="purple"
        >
          <div className="space-y-4">
            <SelectField
              label="Provedor"
              value={config.llm.provider}
              options={options.llmProvider}
              onChange={(v) => {
                const defaultModel = v === 'anthropic' 
                  ? 'claude-sonnet-4-20250514' 
                  : 'gpt-4o';
                setConfig({
                  ...config,
                  llm: { ...config.llm, provider: v, model: defaultModel },
                });
              }}
            />
            <SelectField
              label="Modelo"
              value={config.llm.model}
              options={
                config.llm.provider === 'anthropic'
                  ? options.llmModel.anthropic
                  : options.llmModel.openai
              }
              onChange={(v) => updateNestedConfig('llm', 'model', v)}
            />
            <div className="grid grid-cols-2 gap-4">
              <NumberField
                label="Temperature"
                value={config.llm.temperature}
                min={0}
                max={1}
                step={0.1}
                onChange={(v) => updateNestedConfig('llm', 'temperature', v)}
              />
              <NumberField
                label="Max Tokens"
                value={config.llm.maxTokens}
                min={1000}
                max={100000}
                step={1000}
                onChange={(v) => updateNestedConfig('llm', 'maxTokens', v)}
              />
            </div>
          </div>
        </Section>

        {/* Actions */}
        <Section
          title="Ações Automáticas"
          icon={<GitBranch className="w-5 h-5" />}
          color="green"
        >
          <div className="space-y-4">
            <ToggleField
              label="Gerar testes automaticamente"
              value={config.actions.autoGenerateTests}
              onChange={(v) => updateNestedConfig('actions', 'autoGenerateTests', v)}
            />
            <ToggleField
              label="Criar issues automaticamente"
              value={config.actions.autoCreateIssues}
              onChange={(v) => updateNestedConfig('actions', 'autoCreateIssues', v)}
            />
            <ToggleField
              label="Criar PRs como Draft"
              value={config.actions.createDraftPRs}
              onChange={(v) => updateNestedConfig('actions', 'createDraftPRs', v)}
            />
            <TextField
              label="Labels de Issues"
              value={config.actions.issueLabels.join(', ')}
              onChange={(v) => updateNestedConfig('actions', 'issueLabels', v.split(',').map(s => s.trim()))}
              help="Separadas por vírgula"
            />
            
            <div className="pt-3 border-t border-dark-700">
              <p className="text-sm font-medium text-dark-300 mb-3">Modo Autônomo</p>
              <div className="space-y-3">
                <ToggleField
                  label="Habilitado"
                  value={config.actions.autonomous.enabled}
                  onChange={(v) => setConfig({
                    ...config,
                    actions: {
                      ...config.actions,
                      autonomous: { ...config.actions.autonomous, enabled: v },
                    },
                  })}
                />
                <ToggleField
                  label="Criar PRs de teste"
                  value={config.actions.autonomous.createPR}
                  onChange={(v) => setConfig({
                    ...config,
                    actions: {
                      ...config.actions,
                      autonomous: { ...config.actions.autonomous, createPR: v },
                    },
                  })}
                />
                <ToggleField
                  label="Monitorar CI"
                  value={config.actions.autonomous.monitorCI}
                  onChange={(v) => setConfig({
                    ...config,
                    actions: {
                      ...config.actions,
                      autonomous: { ...config.actions.autonomous, monitorCI: v },
                    },
                  })}
                />
                <ToggleField
                  label="Auto-fix de CI"
                  value={config.actions.autonomous.autoFix}
                  onChange={(v) => setConfig({
                    ...config,
                    actions: {
                      ...config.actions,
                      autonomous: { ...config.actions.autonomous, autoFix: v },
                    },
                  })}
                />
              </div>
            </div>
          </div>
        </Section>

        {/* Notifications */}
        <Section
          title="Notificações Slack"
          icon={<Bell className="w-5 h-5" />}
          color="yellow"
        >
          <div className="space-y-4">
            <ToggleField
              label="Slack habilitado"
              value={config.notifications.slack.enabled}
              onChange={(v) => setConfig({
                ...config,
                notifications: {
                  ...config.notifications,
                  slack: { ...config.notifications.slack, enabled: v },
                },
              })}
            />
            <TextField
              label="Canal"
              value={config.notifications.slack.channel}
              onChange={(v) => setConfig({
                ...config,
                notifications: {
                  ...config.notifications,
                  slack: { ...config.notifications.slack, channel: v },
                },
              })}
              placeholder="#qa-alerts"
            />
            <TextField
              label="Webhook URL"
              value={config.notifications.slack.webhookUrl}
              onChange={(v) => setConfig({
                ...config,
                notifications: {
                  ...config.notifications,
                  slack: { ...config.notifications.slack, webhookUrl: v },
                },
              })}
              placeholder="https://hooks.slack.com/..."
              help="Use ${SLACK_WEBHOOK_URL} no .env"
            />
            
            <div className="pt-3 border-t border-dark-700">
              <p className="text-sm font-medium text-dark-300 mb-3">Notificar quando:</p>
              <div className="grid grid-cols-2 gap-3">
                <ToggleField
                  label="Análise"
                  value={config.notifications.slack.notifyOn.analysis}
                  onChange={(v) => setConfig({
                    ...config,
                    notifications: {
                      ...config.notifications,
                      slack: {
                        ...config.notifications.slack,
                        notifyOn: { ...config.notifications.slack.notifyOn, analysis: v },
                      },
                    },
                  })}
                  compact
                />
                <ToggleField
                  label="PR criado"
                  value={config.notifications.slack.notifyOn.testPRCreated}
                  onChange={(v) => setConfig({
                    ...config,
                    notifications: {
                      ...config.notifications,
                      slack: {
                        ...config.notifications.slack,
                        notifyOn: { ...config.notifications.slack.notifyOn, testPRCreated: v },
                      },
                    },
                  })}
                  compact
                />
                <ToggleField
                  label="CI falhou"
                  value={config.notifications.slack.notifyOn.ciFailure}
                  onChange={(v) => setConfig({
                    ...config,
                    notifications: {
                      ...config.notifications,
                      slack: {
                        ...config.notifications.slack,
                        notifyOn: { ...config.notifications.slack.notifyOn, ciFailure: v },
                      },
                    },
                  })}
                  compact
                />
                <ToggleField
                  label="Risco crítico"
                  value={config.notifications.slack.notifyOn.criticalRisk}
                  onChange={(v) => setConfig({
                    ...config,
                    notifications: {
                      ...config.notifications,
                      slack: {
                        ...config.notifications.slack,
                        notifyOn: { ...config.notifications.slack.notifyOn, criticalRisk: v },
                      },
                    },
                  })}
                  compact
                />
              </div>
            </div>
          </div>
        </Section>

        {/* Coverage */}
        <Section
          title="Cobertura"
          icon={<Shield className="w-5 h-5" />}
          color="cyan"
        >
          <div className="space-y-4">
            <ToggleField
              label="Análise habilitada"
              value={config.coverage.enabled}
              onChange={(v) => updateNestedConfig('coverage', 'enabled', v)}
            />
            <NumberField
              label="Threshold mínimo (%)"
              value={config.coverage.minThreshold}
              min={0}
              max={100}
              onChange={(v) => updateNestedConfig('coverage', 'minThreshold', v)}
            />
            <ToggleField
              label="Falhar se diminuir"
              value={config.coverage.failOnDecrease}
              onChange={(v) => updateNestedConfig('coverage', 'failOnDecrease', v)}
            />
            <ToggleField
              label="Sugerir testes"
              value={config.coverage.suggestTests}
              onChange={(v) => updateNestedConfig('coverage', 'suggestTests', v)}
            />
          </div>
        </Section>

        {/* Feedback */}
        <Section
          title="Feedback & Aprendizado"
          icon={<MessageSquare className="w-5 h-5" />}
          color="pink"
        >
          <div className="space-y-4">
            <ToggleField
              label="Sistema habilitado"
              value={config.feedback.enabled}
              onChange={(v) => updateNestedConfig('feedback', 'enabled', v)}
            />
            <ToggleField
              label="Coletar reações"
              value={config.feedback.collectReactions}
              onChange={(v) => updateNestedConfig('feedback', 'collectReactions', v)}
            />
            <ToggleField
              label="Usar aprendizado"
              value={config.feedback.useLearning}
              onChange={(v) => updateNestedConfig('feedback', 'useLearning', v)}
            />
            <ToggleField
              label="Mostrar estatísticas"
              value={config.feedback.showStats}
              onChange={(v) => updateNestedConfig('feedback', 'showStats', v)}
            />
          </div>
        </Section>
      </div>
    </div>
  );
}

// =============================================================================
// Components
// =============================================================================

const colorClasses = {
  keelo: 'from-keelo-500/20 to-keelo-600/10 border-keelo-500/30',
  purple: 'from-purple-500/20 to-purple-600/10 border-purple-500/30',
  blue: 'from-blue-500/20 to-blue-600/10 border-blue-500/30',
  green: 'from-green-500/20 to-green-600/10 border-green-500/30',
  yellow: 'from-yellow-500/20 to-yellow-600/10 border-yellow-500/30',
  cyan: 'from-cyan-500/20 to-cyan-600/10 border-cyan-500/30',
  pink: 'from-pink-500/20 to-pink-600/10 border-pink-500/30',
};

const iconColorClasses = {
  keelo: 'text-keelo-400',
  purple: 'text-purple-400',
  blue: 'text-blue-400',
  green: 'text-green-400',
  yellow: 'text-yellow-400',
  cyan: 'text-cyan-400',
  pink: 'text-pink-400',
};

interface SectionProps {
  title: string;
  icon: React.ReactNode;
  color: keyof typeof colorClasses;
  children: React.ReactNode;
}

function Section({ title, icon, color, children }: SectionProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className={`bg-gradient-to-br ${colorClasses[color]} bg-dark-900 border rounded-xl overflow-hidden`}
    >
      <div className="flex items-center gap-3 p-4 border-b border-dark-700/50">
        <div className={iconColorClasses[color]}>{icon}</div>
        <h3 className="font-semibold text-dark-100">{title}</h3>
      </div>
      <div className="p-4">
        {children}
      </div>
    </motion.div>
  );
}

interface SelectFieldProps {
  label: string;
  value: string;
  options: Array<{ value: string; label: string }>;
  onChange: (value: string) => void;
  help?: string;
}

function SelectField({ label, value, options, onChange, help }: SelectFieldProps) {
  return (
    <div>
      <label className="block text-sm font-medium text-dark-300 mb-1.5">{label}</label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full px-3 py-2.5 bg-dark-800 border border-dark-700 rounded-lg text-dark-100 focus:ring-2 focus:ring-keelo-500 focus:border-transparent transition-all"
      >
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
      {help && <p className="mt-1.5 text-xs text-dark-500">{help}</p>}
    </div>
  );
}

interface TextFieldProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  help?: string;
}

function TextField({ label, value, onChange, placeholder, help }: TextFieldProps) {
  return (
    <div>
      <label className="block text-sm font-medium text-dark-300 mb-1.5">{label}</label>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full px-3 py-2.5 bg-dark-800 border border-dark-700 rounded-lg text-dark-100 placeholder-dark-500 focus:ring-2 focus:ring-keelo-500 focus:border-transparent transition-all"
      />
      {help && <p className="mt-1.5 text-xs text-dark-500">{help}</p>}
    </div>
  );
}

interface NumberFieldProps {
  label: string;
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  step?: number;
}

function NumberField({ label, value, onChange, min, max, step }: NumberFieldProps) {
  return (
    <div>
      <label className="block text-sm font-medium text-dark-300 mb-1.5">{label}</label>
      <input
        type="number"
        value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        min={min}
        max={max}
        step={step}
        className="w-full px-3 py-2.5 bg-dark-800 border border-dark-700 rounded-lg text-dark-100 focus:ring-2 focus:ring-keelo-500 focus:border-transparent transition-all"
      />
    </div>
  );
}

interface ToggleFieldProps {
  label: string;
  value: boolean;
  onChange: (value: boolean) => void;
  compact?: boolean;
}

function ToggleField({ label, value, onChange, compact }: ToggleFieldProps) {
  return (
    <label className={`flex items-center justify-between cursor-pointer group ${compact ? 'py-1' : 'py-0.5'}`}>
      <span className={`text-dark-300 group-hover:text-dark-200 transition-colors ${compact ? 'text-sm' : ''}`}>
        {label}
      </span>
      <button
        type="button"
        onClick={() => onChange(!value)}
        className={`relative w-11 h-6 rounded-full transition-all duration-200 ${
          value 
            ? 'bg-keelo-500 shadow-lg shadow-keelo-500/30' 
            : 'bg-dark-700'
        }`}
      >
        <span
          className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform duration-200 ${
            value ? 'translate-x-5' : ''
          }`}
        />
      </button>
    </label>
  );
}
