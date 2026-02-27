import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Building2, FolderKanban, ArrowRight, Check, Sparkles } from 'lucide-react';
import { createOrganizationApi, createProjectApi } from '../stores/api';
import { useWorkspaceStore } from '../stores/workspace';

type Step = 'org' | 'project' | 'done';

export default function Onboarding() {
  const navigate = useNavigate();
  const { setCurrentOrg, setCurrentProject, setOrganizations, setProjects } = useWorkspaceStore();

  const [step, setStep] = useState<Step>('org');

  // Org form
  const [orgName, setOrgName] = useState('');
  const [orgSlug, setOrgSlug] = useState('');
  const [orgError, setOrgError] = useState('');
  const [orgLoading, setOrgLoading] = useState(false);

  // Project form
  const [projectName, setProjectName] = useState('');
  const [projectSlug, setProjectSlug] = useState('');
  const [projectDescription, setProjectDescription] = useState('');
  const [projectError, setProjectError] = useState('');
  const [projectLoading, setProjectLoading] = useState(false);

  // Created records
  const [createdOrg, setCreatedOrg] = useState<{ id: string; name: string; slug: string } | null>(null);

  function generateSlug(name: string): string {
    return name
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '')
      .slice(0, 50);
  }

  function handleOrgNameChange(value: string) {
    setOrgName(value);
    setOrgSlug(generateSlug(value));
    setOrgError('');
  }

  function handleProjectNameChange(value: string) {
    setProjectName(value);
    setProjectSlug(generateSlug(value));
    setProjectError('');
  }

  async function handleCreateOrg(e: React.FormEvent) {
    e.preventDefault();
    setOrgError('');

    if (!orgName.trim()) {
      setOrgError('O nome da organização é obrigatório');
      return;
    }
    if (!orgSlug.trim()) {
      setOrgError('O slug é obrigatório');
      return;
    }

    setOrgLoading(true);
    try {
      const res = await createOrganizationApi({
        name: orgName.trim(),
        slug: orgSlug.trim(),
      });

      if (res.success && res.data) {
        setCreatedOrg(res.data);
        setCurrentOrg(res.data as any);
        setOrganizations([res.data as any]);
        setStep('project');
      } else {
        setOrgError((res as any).message || res.error || 'Falha ao criar organização');
      }
    } catch (err) {
      setOrgError('Erro de conexão. Tente novamente.');
    } finally {
      setOrgLoading(false);
    }
  }

  async function handleCreateProject(e: React.FormEvent) {
    e.preventDefault();
    setProjectError('');

    if (!createdOrg) {
      setProjectError('Organização não encontrada');
      return;
    }
    if (!projectName.trim()) {
      setProjectError('O nome do projeto é obrigatório');
      return;
    }
    if (!projectSlug.trim()) {
      setProjectError('O slug é obrigatório');
      return;
    }

    setProjectLoading(true);
    try {
      const res = await createProjectApi(createdOrg.id, {
        name: projectName.trim(),
        slug: projectSlug.trim(),
        description: projectDescription.trim() || undefined,
      });

      if (res.success && res.data) {
        setCurrentProject(res.data as any);
        setProjects([res.data as any]);
        setStep('done');

        // Redirect to dashboard after a brief celebration
        setTimeout(() => {
          navigate('/', { replace: true });
        }, 2000);
      } else {
        setProjectError(res.error || 'Falha ao criar projeto');
      }
    } catch (err) {
      setProjectError('Erro de conexão. Tente novamente.');
    } finally {
      setProjectLoading(false);
    }
  }

  function handleSkipProject() {
    navigate('/', { replace: true });
  }

  return (
    <div className="min-h-screen bg-dark-950 flex items-center justify-center p-6">
      <div className="w-full max-w-lg">
        {/* Header */}
        <motion.div
          className="flex flex-col items-center gap-3 mb-8"
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <img src="/keelo-logo.svg" alt="Keelo" className="w-14 h-14 rounded-xl" />
          <h1 className="text-3xl font-bold gradient-text">Bem-vindo ao Keelo</h1>
          <p className="text-dark-400 text-center">
            Vamos configurar seu workspace em poucos passos
          </p>
        </motion.div>

        {/* Progress Steps */}
        <div className="flex items-center justify-center gap-3 mb-8">
          <StepIndicator
            number={1}
            label="Organização"
            active={step === 'org'}
            completed={step === 'project' || step === 'done'}
          />
          <div className={`w-12 h-0.5 ${step !== 'org' ? 'bg-keelo-500' : 'bg-dark-700'} transition-colors`} />
          <StepIndicator
            number={2}
            label="Projeto"
            active={step === 'project'}
            completed={step === 'done'}
          />
        </div>

        {/* Step Content */}
        <AnimatePresence mode="wait">
          {step === 'org' && (
            <motion.div
              key="org"
              initial={{ opacity: 0, x: 30 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -30 }}
              transition={{ duration: 0.3 }}
            >
              <div className="bg-dark-900 border border-dark-800 rounded-xl p-8">
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-10 h-10 bg-keelo-500/20 rounded-lg flex items-center justify-center">
                    <Building2 className="w-5 h-5 text-keelo-400" />
                  </div>
                  <div>
                    <h2 className="text-xl font-bold text-dark-100">Crie sua organização</h2>
                    <p className="text-sm text-dark-400">Sua empresa, equipe ou workspace pessoal</p>
                  </div>
                </div>

                <form onSubmit={handleCreateOrg} className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-dark-300 mb-1.5">
                      Nome da organização
                    </label>
                    <input
                      type="text"
                      value={orgName}
                      onChange={(e) => handleOrgNameChange(e.target.value)}
                      placeholder="Minha Empresa"
                      className="w-full px-4 py-2.5 bg-dark-800 border border-dark-600 rounded-lg text-dark-100 placeholder-dark-500 focus:outline-none focus:border-keelo-500 focus:ring-1 focus:ring-keelo-500 transition-colors"
                      autoFocus
                      disabled={orgLoading}
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-dark-300 mb-1.5">
                      Slug (URL)
                    </label>
                    <div className="flex items-center gap-2">
                      <span className="text-dark-500 text-sm">keelo.app/</span>
                      <input
                        type="text"
                        value={orgSlug}
                        onChange={(e) => setOrgSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))}
                        placeholder="minha-empresa"
                        className="flex-1 px-4 py-2.5 bg-dark-800 border border-dark-600 rounded-lg text-dark-100 placeholder-dark-500 focus:outline-none focus:border-keelo-500 focus:ring-1 focus:ring-keelo-500 transition-colors"
                        disabled={orgLoading}
                      />
                    </div>
                  </div>

                  {orgError && (
                    <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg">
                      <p className="text-sm text-red-400">{orgError}</p>
                    </div>
                  )}

                  <button
                    type="submit"
                    disabled={orgLoading || !orgName.trim()}
                    className="w-full btn-primary flex items-center justify-center gap-2 py-3 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {orgLoading ? (
                      <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    ) : (
                      <>
                        Continuar
                        <ArrowRight className="w-4 h-4" />
                      </>
                    )}
                  </button>
                </form>
              </div>
            </motion.div>
          )}

          {step === 'project' && (
            <motion.div
              key="project"
              initial={{ opacity: 0, x: 30 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -30 }}
              transition={{ duration: 0.3 }}
            >
              <div className="bg-dark-900 border border-dark-800 rounded-xl p-8">
                <div className="flex items-center gap-3 mb-2">
                  <div className="w-10 h-10 bg-purple-500/20 rounded-lg flex items-center justify-center">
                    <FolderKanban className="w-5 h-5 text-purple-400" />
                  </div>
                  <div>
                    <h2 className="text-xl font-bold text-dark-100">Crie seu primeiro projeto</h2>
                    <p className="text-sm text-dark-400">
                      em <span className="text-keelo-400 font-medium">{createdOrg?.name}</span>
                    </p>
                  </div>
                </div>

                <p className="text-dark-400 text-sm mb-6">
                  Projetos organizam suas análises. Ex: "Backend API", "App Mobile", "Portal do Cliente".
                </p>

                <form onSubmit={handleCreateProject} className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-dark-300 mb-1.5">
                      Nome do projeto
                    </label>
                    <input
                      type="text"
                      value={projectName}
                      onChange={(e) => handleProjectNameChange(e.target.value)}
                      placeholder="Meu Projeto"
                      className="w-full px-4 py-2.5 bg-dark-800 border border-dark-600 rounded-lg text-dark-100 placeholder-dark-500 focus:outline-none focus:border-keelo-500 focus:ring-1 focus:ring-keelo-500 transition-colors"
                      autoFocus
                      disabled={projectLoading}
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-dark-300 mb-1.5">
                      Slug (URL)
                    </label>
                    <div className="flex items-center gap-2">
                      <span className="text-dark-500 text-sm truncate">{createdOrg?.slug}/</span>
                      <input
                        type="text"
                        value={projectSlug}
                        onChange={(e) => setProjectSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))}
                        placeholder="meu-projeto"
                        className="flex-1 px-4 py-2.5 bg-dark-800 border border-dark-600 rounded-lg text-dark-100 placeholder-dark-500 focus:outline-none focus:border-keelo-500 focus:ring-1 focus:ring-keelo-500 transition-colors"
                        disabled={projectLoading}
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-dark-300 mb-1.5">
                      Descrição <span className="text-dark-500">(opcional)</span>
                    </label>
                    <textarea
                      value={projectDescription}
                      onChange={(e) => setProjectDescription(e.target.value)}
                      placeholder="Uma breve descrição do projeto..."
                      rows={2}
                      className="w-full px-4 py-2.5 bg-dark-800 border border-dark-600 rounded-lg text-dark-100 placeholder-dark-500 focus:outline-none focus:border-keelo-500 focus:ring-1 focus:ring-keelo-500 transition-colors resize-none"
                      disabled={projectLoading}
                    />
                  </div>

                  {projectError && (
                    <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg">
                      <p className="text-sm text-red-400">{projectError}</p>
                    </div>
                  )}

                  <button
                    type="submit"
                    disabled={projectLoading || !projectName.trim()}
                    className="w-full btn-primary flex items-center justify-center gap-2 py-3 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {projectLoading ? (
                      <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    ) : (
                      <>
                        Criar projeto
                        <ArrowRight className="w-4 h-4" />
                      </>
                    )}
                  </button>

                  <button
                    type="button"
                    onClick={handleSkipProject}
                    className="w-full py-2 text-sm text-dark-400 hover:text-dark-200 transition-colors"
                  >
                    Pular por agora
                  </button>
                </form>
              </div>
            </motion.div>
          )}

          {step === 'done' && (
            <motion.div
              key="done"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.4, type: 'spring' }}
            >
              <div className="bg-dark-900 border border-keelo-500/30 rounded-xl p-8 text-center">
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ delay: 0.2, type: 'spring', stiffness: 200 }}
                >
                  <div className="w-16 h-16 bg-keelo-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
                    <Sparkles className="w-8 h-8 text-keelo-400" />
                  </div>
                </motion.div>

                <h2 className="text-2xl font-bold text-dark-100 mb-2">Tudo pronto! 🎉</h2>
                <p className="text-dark-400 mb-4">
                  Seu workspace está configurado. Redirecionando para o dashboard...
                </p>

                <div className="w-8 h-8 border-3 border-keelo-500 border-t-transparent rounded-full animate-spin mx-auto" />
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

// =============================================================================
// Step Indicator Component
// =============================================================================

function StepIndicator({
  number,
  label,
  active,
  completed,
}: {
  number: number;
  label: string;
  active: boolean;
  completed: boolean;
}) {
  return (
    <div className="flex flex-col items-center gap-1.5">
      <div
        className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold transition-all duration-300 ${
          completed
            ? 'bg-keelo-500 text-white'
            : active
            ? 'bg-keelo-500/20 text-keelo-400 ring-2 ring-keelo-500/50'
            : 'bg-dark-800 text-dark-500'
        }`}
      >
        {completed ? <Check className="w-4 h-4" /> : number}
      </div>
      <span
        className={`text-xs font-medium ${
          active || completed ? 'text-dark-200' : 'text-dark-500'
        }`}
      >
        {label}
      </span>
    </div>
  );
}

