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
  Building2,
  FolderKanban,
  Users,
  Plus,
  Trash2,
  Crown,
  UserPlus,
  Mail,
} from 'lucide-react';
import { 
  getSettings, 
  getSettingsOptions, 
  updateSettings, 
  resetSettings,
  getProjects,
  createProjectApi,
  getOrgMembers,
  addOrgMemberApi,
  removeOrgMemberApi,
  deleteProjectApi,
  type KeeloConfig,
  type ConfigOptions,
  type Project,
  type OrgMember,
} from '../stores/api';
import { useWorkspaceStore } from '../stores/workspace';

export default function Settings() {
  const [config, setConfig] = useState<KeeloConfig | null>(null);
  const [options, setOptions] = useState<ConfigOptions | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Organization management state
  const { currentOrg } = useWorkspaceStore();
  const [orgProjects, setOrgProjects] = useState<Project[]>([]);
  const [orgMembers, setOrgMembers] = useState<OrgMember[]>([]);
  const [newProjectName, setNewProjectName] = useState('');
  const [newProjectSlug, setNewProjectSlug] = useState('');
  const [newMemberEmail, setNewMemberEmail] = useState('');
  const [orgActionLoading, setOrgActionLoading] = useState(false);
  const [orgError, setOrgError] = useState<string | null>(null);
  const [orgSuccess, setOrgSuccess] = useState<string | null>(null);
  const [activeOrgTab, setActiveOrgTab] = useState<'projects' | 'members'>('projects');

  useEffect(() => {
    loadData();
  }, []);

  // Load org projects and members when org changes
  useEffect(() => {
    if (currentOrg) {
      loadOrgData(currentOrg.id);
    }
  }, [currentOrg?.id]);

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

  async function loadOrgData(orgId: string) {
    try {
      const [projectsRes, membersRes] = await Promise.all([
        getProjects(orgId),
        getOrgMembers(orgId),
      ]);
      if (projectsRes.success) setOrgProjects(projectsRes.data);
      if (membersRes.success) setOrgMembers(membersRes.data);
    } catch {
      // Silent fail
    }
  }

  async function handleCreateProject(e: React.FormEvent) {
    e.preventDefault();
    if (!currentOrg || !newProjectName.trim()) return;

    setOrgActionLoading(true);
    setOrgError(null);
    try {
      const slug = newProjectSlug.trim() || newProjectName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
      const res = await createProjectApi(currentOrg.id, {
        name: newProjectName.trim(),
        slug,
      });
      if (res.success) {
        setNewProjectName('');
        setNewProjectSlug('');
        setOrgSuccess('Projeto criado!');
        setTimeout(() => setOrgSuccess(null), 3000);
        await loadOrgData(currentOrg.id);
      } else {
        setOrgError(res.error || 'Falha ao criar projeto');
      }
    } catch {
      setOrgError('Erro de conexão');
    } finally {
      setOrgActionLoading(false);
    }
  }

  async function handleDeleteProject(projectId: string) {
    if (!currentOrg || !confirm('Tem certeza? Todas as análises deste projeto serão excluídas.')) return;

    try {
      const res = await deleteProjectApi(currentOrg.id, projectId);
      if (res.success) {
        await loadOrgData(currentOrg.id);
        setOrgSuccess('Projeto excluído');
        setTimeout(() => setOrgSuccess(null), 3000);
      }
    } catch {
      setOrgError('Falha ao excluir projeto');
    }
  }

  async function handleAddMember(e: React.FormEvent) {
    e.preventDefault();
    if (!currentOrg || !newMemberEmail.trim()) return;

    setOrgActionLoading(true);
    setOrgError(null);
    try {
      const res = await addOrgMemberApi(currentOrg.id, newMemberEmail.trim());
      if (res.success) {
        setNewMemberEmail('');
        setOrgSuccess('Membro adicionado!');
        setTimeout(() => setOrgSuccess(null), 3000);
        await loadOrgData(currentOrg.id);
      } else {
        setOrgError(res.error || res.message || 'Falha ao adicionar membro');
      }
    } catch {
      setOrgError('Erro de conexão');
    } finally {
      setOrgActionLoading(false);
    }
  }

  async function handleRemoveMember(userId: string) {
    if (!currentOrg || !confirm('Tem certeza que deseja remover este membro?')) return;

    try {
      const res = await removeOrgMemberApi(currentOrg.id, userId);
      if (res.success) {
        await loadOrgData(currentOrg.id);
        setOrgSuccess('Membro removido');
        setTimeout(() => setOrgSuccess(null), 3000);
      }
    } catch {
      setOrgError('Falha ao remover membro');
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

      {/* Organization Management */}
      {currentOrg && (
        <div className="space-y-4">
          <Section
            title={`Organização: ${currentOrg.name}`}
            icon={<Building2 className="w-5 h-5" />}
            color="keelo"
          >
            <div className="space-y-4">
              {/* Tab Switcher */}
              <div className="flex gap-1 p-1 bg-dark-800/50 rounded-lg">
                <button
                  onClick={() => setActiveOrgTab('projects')}
                  className={`flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-md text-sm font-medium transition-all ${
                    activeOrgTab === 'projects'
                      ? 'bg-dark-700 text-dark-100'
                      : 'text-dark-400 hover:text-dark-200'
                  }`}
                >
                  <FolderKanban size={16} />
                  Projetos ({orgProjects.length})
                </button>
                <button
                  onClick={() => setActiveOrgTab('members')}
                  className={`flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-md text-sm font-medium transition-all ${
                    activeOrgTab === 'members'
                      ? 'bg-dark-700 text-dark-100'
                      : 'text-dark-400 hover:text-dark-200'
                  }`}
                >
                  <Users size={16} />
                  Membros ({orgMembers.length})
                </button>
              </div>

              {/* Messages */}
              {orgError && (
                <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg">
                  <p className="text-sm text-red-400">{orgError}</p>
                </div>
              )}
              {orgSuccess && (
                <div className="p-3 bg-green-500/10 border border-green-500/20 rounded-lg">
                  <p className="text-sm text-green-400">{orgSuccess}</p>
                </div>
              )}

              {/* Projects Tab */}
              {activeOrgTab === 'projects' && (
                <div className="space-y-3">
                  {/* Project List */}
                  {orgProjects.length > 0 ? (
                    <div className="space-y-2">
                      {orgProjects.map((project) => (
                        <div
                          key={project.id}
                          className="flex items-center justify-between p-3 bg-dark-800/50 rounded-lg"
                        >
                          <div className="flex items-center gap-3">
                            <FolderKanban size={16} className="text-purple-400" />
                            <div>
                              <p className="text-sm font-medium text-dark-100">{project.name}</p>
                              <p className="text-xs text-dark-500">{project.slug} · {project.analysis_count || 0} análises</p>
                            </div>
                          </div>
                          <button
                            onClick={() => handleDeleteProject(project.id)}
                            className="p-1.5 text-dark-500 hover:text-red-400 transition-colors"
                            title="Excluir projeto"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-dark-500 text-center py-4">
                      Nenhum projeto ainda. Crie um abaixo.
                    </p>
                  )}

                  {/* Create Project Form */}
                  <form onSubmit={handleCreateProject} className="flex gap-2 pt-2 border-t border-dark-700/50">
                    <input
                      type="text"
                      value={newProjectName}
                      onChange={(e) => {
                        setNewProjectName(e.target.value);
                        setNewProjectSlug(e.target.value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''));
                      }}
                      placeholder="Nome do projeto"
                      className="flex-1 px-3 py-2 bg-dark-800 border border-dark-700 rounded-lg text-sm text-dark-100 placeholder-dark-500 focus:outline-none focus:border-keelo-500"
                      disabled={orgActionLoading}
                    />
                    <button
                      type="submit"
                      disabled={orgActionLoading || !newProjectName.trim()}
                      className="px-3 py-2 bg-keelo-500 text-white rounded-lg text-sm font-medium hover:bg-keelo-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5"
                    >
                      <Plus size={14} />
                      Criar
                    </button>
                  </form>
                </div>
              )}

              {/* Members Tab */}
              {activeOrgTab === 'members' && (
                <div className="space-y-3">
                  {/* Member List */}
                  {orgMembers.length > 0 ? (
                    <div className="space-y-2">
                      {orgMembers.map((member) => (
                        <div
                          key={member.id}
                          className="flex items-center justify-between p-3 bg-dark-800/50 rounded-lg"
                        >
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-keelo-500 to-keelo-600 flex items-center justify-center">
                              <span className="text-white text-xs font-medium">
                                {(member.user_name || member.user_email || '?').charAt(0).toUpperCase()}
                              </span>
                            </div>
                            <div>
                              <p className="text-sm font-medium text-dark-100">
                                {member.user_name || member.user_email}
                              </p>
                              <div className="flex items-center gap-2">
                                <p className="text-xs text-dark-500">{member.user_email}</p>
                                {member.role === 'owner' && (
                                  <span className="flex items-center gap-0.5 text-xs text-amber-400">
                                    <Crown size={10} /> Owner
                                  </span>
                                )}
                                {member.role === 'admin' && (
                                  <span className="text-xs text-keelo-400">Admin</span>
                                )}
                              </div>
                            </div>
                          </div>
                          {member.role !== 'owner' && (
                            <button
                              onClick={() => handleRemoveMember(member.user_id)}
                              className="p-1.5 text-dark-500 hover:text-red-400 transition-colors"
                              title="Remover membro"
                            >
                              <Trash2 size={14} />
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-dark-500 text-center py-4">
                      Nenhum membro além de você.
                    </p>
                  )}

                  {/* Add Member Form */}
                  <form onSubmit={handleAddMember} className="flex gap-2 pt-2 border-t border-dark-700/50">
                    <div className="flex-1 relative">
                      <Mail size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-dark-500" />
                      <input
                        type="email"
                        value={newMemberEmail}
                        onChange={(e) => setNewMemberEmail(e.target.value)}
                        placeholder="email@exemplo.com"
                        className="w-full pl-8 pr-3 py-2 bg-dark-800 border border-dark-700 rounded-lg text-sm text-dark-100 placeholder-dark-500 focus:outline-none focus:border-keelo-500"
                        disabled={orgActionLoading}
                      />
                    </div>
                    <button
                      type="submit"
                      disabled={orgActionLoading || !newMemberEmail.trim()}
                      className="px-3 py-2 bg-keelo-500 text-white rounded-lg text-sm font-medium hover:bg-keelo-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5"
                    >
                      <UserPlus size={14} />
                      Convidar
                    </button>
                  </form>
                </div>
              )}
            </div>
          </Section>
        </div>
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
