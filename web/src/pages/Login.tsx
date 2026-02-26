import { useState } from 'react';
import { Navigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { GitPullRequest, FileSearch, Zap, Eye, EyeOff, LogIn } from 'lucide-react';
import { useAuth, isGoogleConfigured } from '../auth/AuthProvider';

export default function Login() {
  const { isAuthenticated, isLoading, login, loginWithCredentials } = useAuth();
  const [showPasswordForm, setShowPasswordForm] = useState(!isGoogleConfigured());
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-dark-950">
        <div className="w-12 h-12 border-4 border-keelo-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (isAuthenticated) {
    return <Navigate to="/" replace />;
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!username.trim() || !password.trim()) {
      setError('Preencha usuário e senha');
      return;
    }

    setSubmitting(true);
    const result = await loginWithCredentials(username, password);
    setSubmitting(false);

    if (!result.success) {
      setError(result.error || 'Falha no login');
    }
  };

  return (
    <div className="min-h-screen bg-dark-950 flex">
      {/* Left Side - Branding */}
      <div className="hidden lg:flex lg:w-1/2 bg-gradient-to-br from-keelo-600 via-keelo-700 to-keelo-900 p-12 flex-col justify-between relative overflow-hidden">
        {/* Background Pattern */}
        <div className="absolute inset-0 opacity-10">
          <div className="absolute top-0 left-0 w-96 h-96 bg-white rounded-full -translate-x-1/2 -translate-y-1/2" />
          <div className="absolute bottom-0 right-0 w-64 h-64 bg-white rounded-full translate-x-1/2 translate-y-1/2" />
        </div>

        <div className="relative z-10">
          <div className="flex items-center gap-3">
            <img 
              src="/keelo-logo.svg" 
              alt="Keelo" 
              className="w-12 h-12 rounded-xl"
            />
            <span className="text-3xl font-bold text-white">Keelo</span>
          </div>
          <p className="text-keelo-100 mt-2 text-lg">QA Intelligence Platform</p>
        </div>

        <div className="relative z-10 space-y-8">
          <div className="flex items-start gap-4">
            <div className="p-3 bg-white/10 rounded-xl">
              <GitPullRequest className="w-6 h-6 text-white" />
            </div>
            <div>
              <h3 className="text-white font-semibold">Revisão Inteligente de PRs</h3>
              <p className="text-keelo-100 text-sm mt-1">
                Análise automática de Pull Requests com IA para identificar riscos e gerar cenários de teste.
              </p>
            </div>
          </div>

          <div className="flex items-start gap-4">
            <div className="p-3 bg-white/10 rounded-xl">
              <FileSearch className="w-6 h-6 text-white" />
            </div>
            <div>
              <h3 className="text-white font-semibold">Análise de Requisitos</h3>
              <p className="text-keelo-100 text-sm mt-1">
                Valide requisitos antes do código. Analise user stories, Figma e PDFs.
              </p>
            </div>
          </div>

          <div className="flex items-start gap-4">
            <div className="p-3 bg-white/10 rounded-xl">
              <Zap className="w-6 h-6 text-white" />
            </div>
            <div>
              <h3 className="text-white font-semibold">Testes Automatizados</h3>
              <p className="text-keelo-100 text-sm mt-1">
                Geração automática de cenários e código de teste com base nas análises.
              </p>
            </div>
          </div>
        </div>

        <div className="relative z-10 text-keelo-200 text-sm">
          <span>Keelo v1.0 — Autonomous QA Agent</span>
        </div>
      </div>

      {/* Right Side - Login Form */}
      <div className="flex-1 flex items-center justify-center p-8">
        <motion.div
          className="w-full max-w-md"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          {/* Mobile Logo */}
          <div className="lg:hidden flex flex-col items-center justify-center gap-2 mb-8">
            <div className="flex items-center gap-3">
              <img 
                src="/keelo-logo.svg" 
                alt="Keelo" 
                className="w-12 h-12 rounded-xl"
              />
              <span className="text-3xl font-bold gradient-text">Keelo</span>
            </div>
            <span className="text-sm text-dark-400">QA Intelligence Platform</span>
          </div>

          <div className="card">
            <div className="text-center mb-8">
              <h1 className="text-2xl font-bold text-dark-100">Bem-vindo ao Keelo</h1>
              <p className="text-dark-400 mt-2">Faça login para acessar o painel</p>
            </div>

            {/* Username/Password Form */}
            {showPasswordForm && (
              <form onSubmit={handleSubmit} className="space-y-4 mb-4">
                <div>
                  <label htmlFor="username" className="block text-sm font-medium text-dark-300 mb-1.5">
                    Usuário
                  </label>
                  <input
                    id="username"
                    type="text"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    className="w-full px-4 py-2.5 bg-dark-800 border border-dark-600 rounded-lg text-dark-100 
                               placeholder-dark-500 focus:outline-none focus:border-keelo-500 focus:ring-1 focus:ring-keelo-500
                               transition-colors"
                    placeholder="Digite seu usuário"
                    autoComplete="username"
                    disabled={submitting}
                  />
                </div>

                <div>
                  <label htmlFor="password" className="block text-sm font-medium text-dark-300 mb-1.5">
                    Senha
                  </label>
                  <div className="relative">
                    <input
                      id="password"
                      type={showPassword ? 'text' : 'password'}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="w-full px-4 py-2.5 bg-dark-800 border border-dark-600 rounded-lg text-dark-100 
                                 placeholder-dark-500 focus:outline-none focus:border-keelo-500 focus:ring-1 focus:ring-keelo-500
                                 transition-colors pr-12"
                      placeholder="Digite sua senha"
                      autoComplete="current-password"
                      disabled={submitting}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-dark-400 hover:text-dark-200 transition-colors"
                      tabIndex={-1}
                    >
                      {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                    </button>
                  </div>
                </div>

                {error && (
                  <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg">
                    <p className="text-sm text-red-400">{error}</p>
                  </div>
                )}

                <button
                  type="submit"
                  disabled={submitting}
                  className="w-full btn-primary flex items-center justify-center gap-2 py-3 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {submitting ? (
                    <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <>
                      <LogIn className="w-5 h-5" />
                      Entrar
                    </>
                  )}
                </button>
              </form>
            )}

            {/* Google Login */}
            {isGoogleConfigured() && (
              <>
                {showPasswordForm && (
                  <div className="relative my-6">
                    <div className="absolute inset-0 flex items-center">
                      <div className="w-full border-t border-dark-700" />
                    </div>
                    <div className="relative flex justify-center text-sm">
                      <span className="px-3 bg-dark-900 text-dark-500">ou</span>
                    </div>
                  </div>
                )}

                <button
                  onClick={login}
                  className={`w-full flex items-center justify-center gap-3 py-3 ${
                    showPasswordForm
                      ? 'bg-dark-800 border border-dark-600 rounded-lg text-dark-200 hover:bg-dark-700 hover:border-dark-500 transition-colors'
                      : 'btn-primary'
                  }`}
                >
                  <svg className="w-5 h-5" viewBox="0 0 24 24">
                    <path
                      fill="currentColor"
                      d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"
                    />
                    <path
                      fill="currentColor"
                      d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                    />
                    <path
                      fill="currentColor"
                      d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                    />
                    <path
                      fill="currentColor"
                      d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                    />
                  </svg>
                  Entrar com Google
                </button>

                {!showPasswordForm && (
                  <button
                    onClick={() => setShowPasswordForm(true)}
                    className="w-full mt-3 text-sm text-dark-500 hover:text-dark-300 transition-colors"
                  >
                    Entrar com usuário e senha
                  </button>
                )}
              </>
            )}

            {!isGoogleConfigured() && !showPasswordForm && (
              <button
                onClick={login}
                className="w-full btn-primary flex items-center justify-center gap-3 py-3"
              >
                Entrar (Modo Demo)
              </button>
            )}
          </div>

          <p className="text-center text-dark-500 text-sm mt-6">
            Ao entrar, você concorda com nossos Termos de Serviço e Política de Privacidade.
          </p>
        </motion.div>
      </div>
    </div>
  );
}
