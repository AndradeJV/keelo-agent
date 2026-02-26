import { Navigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { GitPullRequest, FileSearch, Zap } from 'lucide-react';
import { useAuth, isGoogleConfigured } from '../auth/AuthProvider';

export default function Login() {
  const { isAuthenticated, isLoading, login } = useAuth();

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

  return (
    <div className="min-h-screen bg-dark-950 flex">
      {/* Left Side - Branding */}
      <div className="hidden lg:flex lg:w-1/2 bg-gradient-to-br from-keelo-600 to-keelo-800 p-12 flex-col justify-between relative overflow-hidden">
        {/* Background Pattern */}
        <div className="absolute inset-0 opacity-10">
          <div className="absolute top-0 left-0 w-96 h-96 bg-white rounded-full -translate-x-1/2 -translate-y-1/2" />
          <div className="absolute bottom-0 right-0 w-64 h-64 bg-white rounded-full translate-x-1/2 translate-y-1/2" />
        </div>

        <div className="relative z-10">
          <div className="flex items-center gap-3">
            <img 
              src="/trace-logo.jpeg" 
              alt="Trace Finance" 
              className="w-12 h-12 rounded-xl object-cover"
            />
            <span className="text-3xl font-bold text-white">Keelo</span>
          </div>
          <p className="text-keelo-100 mt-2 text-lg">QA Intelligence Platform</p>
          <p className="text-keelo-200 mt-1 text-sm">by Trace Finance</p>
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
                src="/trace-logo.jpeg" 
                alt="Trace Finance" 
                className="w-12 h-12 rounded-xl object-cover"
              />
              <span className="text-3xl font-bold gradient-text">Keelo</span>
            </div>
            <span className="text-sm text-dark-400">by Trace Finance</span>
          </div>

          <div className="card">
            <div className="text-center mb-8">
              <h1 className="text-2xl font-bold text-dark-100">Bem-vindo ao Keelo</h1>
              <p className="text-dark-400 mt-2">Faça login para acessar o painel</p>
            </div>

            <button
              onClick={login}
              className="w-full btn-primary flex items-center justify-center gap-3 py-3"
            >
              {isGoogleConfigured() ? (
                <>
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
                </>
              ) : (
                'Entrar (Modo Demo)'
              )}
            </button>

            {!isGoogleConfigured() && (
              <div className="mt-4 p-4 bg-dark-800/50 rounded-lg border border-dark-700">
                <p className="text-sm text-dark-400">
                  <span className="text-yellow-500 font-medium">Modo Demo:</span> Google OAuth não está configurado. 
                  Configure <code className="text-yellow-400">VITE_GOOGLE_CLIENT_ID</code> para habilitar autenticação real.
                </p>
              </div>
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
