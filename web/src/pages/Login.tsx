import { useState, useEffect } from 'react';
import { Navigate, Link, useSearchParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { GitPullRequest, FileSearch, Zap, Eye, EyeOff, LogIn, Github, CheckCircle, AlertCircle } from 'lucide-react';
import { useAuth, isGoogleConfigured, isGithubConfigured, isSocialLoginConfigured } from '../auth/AuthProvider';

const API_BASE = import.meta.env.VITE_API_URL || '/api';

export default function Login() {
  const { isAuthenticated, isLoading, login, loginWithCredentials, loginWithGithub } = useAuth();
  const [searchParams] = useSearchParams();
  const [showPasswordForm, setShowPasswordForm] = useState(!isSocialLoginConfigured());
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [emailNotVerified, setEmailNotVerified] = useState<string | null>(null);
  const [resending, setResending] = useState(false);

  // Handle query params (confirmed email, errors)
  useEffect(() => {
    const confirmed = searchParams.get('confirmed');
    const errorParam = searchParams.get('error');

    if (confirmed === 'true') {
      setInfo('Email confirmado com sucesso! Faça login para continuar.');
    }
    if (errorParam) {
      setError(decodeURIComponent(errorParam));
    }
  }, [searchParams]);

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
    setInfo('');
    setEmailNotVerified(null);

    if (!username.trim() || !password.trim()) {
      setError('Preencha usuário e senha');
      return;
    }

    setSubmitting(true);
    const result = await loginWithCredentials(username, password);
    setSubmitting(false);

    if (!result.success) {
      if (result.code === 'EMAIL_NOT_VERIFIED' && result.email) {
        setEmailNotVerified(result.email);
        setError('');
      } else {
        setError(result.error || 'Falha no login');
      }
    }
  };

  const handleResendVerification = async () => {
    if (!emailNotVerified || resending) return;
    setResending(true);
    try {
      await fetch(`${API_BASE}/auth/resend-verification`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: emailNotVerified }),
      });
      setInfo('Email de verificação reenviado!');
      setEmailNotVerified(null);
    } catch {
      setError('Falha ao reenviar email');
    } finally {
      setResending(false);
    }
  };

  const hasSocial = isSocialLoginConfigured();

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

            {/* Info message (e.g. email confirmed) */}
            {info && (
              <div className="p-3 bg-keelo-500/10 border border-keelo-500/20 rounded-lg mb-4 flex items-center gap-2">
                <CheckCircle className="w-4 h-4 text-keelo-400 flex-shrink-0" />
                <p className="text-sm text-keelo-400">{info}</p>
              </div>
            )}

            {/* Email not verified message */}
            {emailNotVerified && (
              <div className="p-3 bg-yellow-500/10 border border-yellow-500/20 rounded-lg mb-4">
                <div className="flex items-center gap-2 mb-1">
                  <AlertCircle className="w-4 h-4 text-yellow-400 flex-shrink-0" />
                  <p className="text-sm text-yellow-400 font-medium">Email não verificado</p>
                </div>
                <p className="text-xs text-yellow-400/70 mt-1">
                  Verifique sua caixa de entrada ({emailNotVerified}).{' '}
                  <button
                    onClick={handleResendVerification}
                    disabled={resending}
                    className="underline hover:text-yellow-300 transition-colors"
                  >
                    {resending ? 'Reenviando...' : 'Reenviar email'}
                  </button>
                </p>
              </div>
            )}

            {/* Social Login Buttons */}
            {hasSocial && !showPasswordForm && (
              <div className="space-y-3 mb-4">
                {isGoogleConfigured() && (
                  <button
                    onClick={login}
                    className="w-full flex items-center justify-center gap-3 py-3 btn-primary"
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
                )}

                {isGithubConfigured() && (
                  <button
                    onClick={loginWithGithub}
                    className="w-full flex items-center justify-center gap-3 py-3 bg-dark-800 border border-dark-600 rounded-lg text-dark-200 hover:bg-dark-700 hover:border-dark-500 transition-colors"
                  >
                    <Github className="w-5 h-5" />
                    Entrar com GitHub
                  </button>
                )}

                <button
                  onClick={() => setShowPasswordForm(true)}
                  className="w-full text-sm text-dark-500 hover:text-dark-300 transition-colors mt-2"
                >
                  Entrar com email e senha
                </button>
              </div>
            )}

            {/* Username/Password Form */}
            {showPasswordForm && (
              <>
                <form onSubmit={handleSubmit} className="space-y-4 mb-4">
                  <div>
                    <label htmlFor="username" className="block text-sm font-medium text-dark-300 mb-1.5">
                      Email ou usuário
                    </label>
                    <input
                      id="username"
                      type="text"
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      className="w-full px-4 py-2.5 bg-dark-800 border border-dark-600 rounded-lg text-dark-100 
                                 placeholder-dark-500 focus:outline-none focus:border-keelo-500 focus:ring-1 focus:ring-keelo-500
                                 transition-colors"
                      placeholder="seu@email.com ou usuário"
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

                {/* Social login buttons (secondary) */}
                {hasSocial && (
                  <>
                    <div className="relative my-6">
                      <div className="absolute inset-0 flex items-center">
                        <div className="w-full border-t border-dark-700" />
                      </div>
                      <div className="relative flex justify-center text-sm">
                        <span className="px-3 bg-dark-900 text-dark-500">ou</span>
                      </div>
                    </div>

                    <div className="space-y-3">
                      {isGoogleConfigured() && (
                        <button
                          onClick={login}
                          className="w-full flex items-center justify-center gap-3 py-3 bg-dark-800 border border-dark-600 rounded-lg text-dark-200 hover:bg-dark-700 hover:border-dark-500 transition-colors"
                        >
                          <svg className="w-5 h-5" viewBox="0 0 24 24">
                            <path fill="currentColor" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" />
                            <path fill="currentColor" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                            <path fill="currentColor" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                            <path fill="currentColor" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                          </svg>
                          Entrar com Google
                        </button>
                      )}

                      {isGithubConfigured() && (
                        <button
                          onClick={loginWithGithub}
                          className="w-full flex items-center justify-center gap-3 py-3 bg-dark-800 border border-dark-600 rounded-lg text-dark-200 hover:bg-dark-700 hover:border-dark-500 transition-colors"
                        >
                          <Github className="w-5 h-5" />
                          Entrar com GitHub
                        </button>
                      )}
                    </div>
                  </>
                )}
              </>
            )}

            {/* Demo mode button */}
            {!isSocialLoginConfigured() && !showPasswordForm && (
              <button
                onClick={login}
                className="w-full btn-primary flex items-center justify-center gap-3 py-3"
              >
                Entrar (Modo Demo)
              </button>
            )}

            {/* Register link */}
            <div className="mt-6 text-center">
              <span className="text-dark-500 text-sm">Não tem uma conta? </span>
              <Link to="/register" className="text-sm text-keelo-400 hover:text-keelo-300 transition-colors font-medium">
                Criar conta
              </Link>
            </div>
          </div>

          <p className="text-center text-dark-500 text-sm mt-6">
            Ao entrar, você concorda com nossos Termos de Serviço e Política de Privacidade.
          </p>
        </motion.div>
      </div>
    </div>
  );
}
