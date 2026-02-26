import { Navigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Shield, GitPullRequest, FileSearch, Zap } from 'lucide-react';
import { useAuth, isOktaConfigured } from '../auth/AuthProvider';

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
          <motion.div
            className="flex items-start gap-4"
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.2 }}
          >
            <div className="w-12 h-12 bg-white/20 backdrop-blur-sm rounded-lg flex items-center justify-center flex-shrink-0">
              <GitPullRequest className="w-6 h-6 text-white" />
            </div>
            <div>
              <h3 className="font-semibold text-white text-lg">Análise de PRs</h3>
              <p className="text-keelo-100">
                Análise automática de Pull Requests com IA para identificar riscos e gerar cenários de teste.
              </p>
            </div>
          </motion.div>

          <motion.div
            className="flex items-start gap-4"
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.3 }}
          >
            <div className="w-12 h-12 bg-white/20 backdrop-blur-sm rounded-lg flex items-center justify-center flex-shrink-0">
              <FileSearch className="w-6 h-6 text-white" />
            </div>
            <div>
              <h3 className="font-semibold text-white text-lg">Análise de Requisitos</h3>
              <p className="text-keelo-100">
                Gere cenários de teste antes do desenvolvimento com base em Figma, histórias de usuário e PDFs.
              </p>
            </div>
          </motion.div>

          <motion.div
            className="flex items-start gap-4"
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.4 }}
          >
            <div className="w-12 h-12 bg-white/20 backdrop-blur-sm rounded-lg flex items-center justify-center flex-shrink-0">
              <Zap className="w-6 h-6 text-white" />
            </div>
            <div>
              <h3 className="font-semibold text-white text-lg">Execução Autônoma</h3>
              <p className="text-keelo-100">
                Gere testes automaticamente, abra PRs e monitore CI sem intervenção manual.
              </p>
            </div>
          </motion.div>
        </div>

        <div className="relative z-10 text-keelo-200 text-sm flex items-center gap-2">
          <span>© 2024 Keelo by Trace Finance. Todos os direitos reservados.</span>
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
              <h1 className="text-2xl font-bold text-dark-100">Bem-vindo de volta</h1>
              <p className="text-dark-400 mt-2">Faça login para acessar o painel</p>
            </div>

            <button
              onClick={login}
              className="w-full btn-primary flex items-center justify-center gap-3 py-3"
            >
              <Shield size={20} />
              {isOktaConfigured() ? 'Entrar com Okta' : 'Entrar (Modo Demo)'}
            </button>

            {!isOktaConfigured() && (
              <div className="mt-4 p-4 bg-dark-800/50 rounded-lg border border-dark-700">
                <p className="text-sm text-dark-400">
                  <span className="text-yellow-500 font-medium">Modo Demo:</span> Okta não está configurado. 
                  Configure as variáveis de ambiente para habilitar autenticação real.
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

