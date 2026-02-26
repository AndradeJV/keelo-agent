import { useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { UserPlus, Eye, EyeOff, Mail, CheckCircle, ArrowLeft } from 'lucide-react';
import { useAuth } from '../auth/AuthProvider';

const API_BASE = import.meta.env.VITE_API_URL || '/api';

export default function Register() {
  const { isAuthenticated, isLoading } = useAuth();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [registered, setRegistered] = useState(false);
  const [emailSent, setEmailSent] = useState(false);

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

    if (!name.trim() || !email.trim() || !password.trim()) {
      setError('Preencha todos os campos');
      return;
    }

    if (password.length < 8) {
      setError('A senha deve ter pelo menos 8 caracteres');
      return;
    }

    if (password !== confirmPassword) {
      setError('As senhas não conferem');
      return;
    }

    setSubmitting(true);

    try {
      const res = await fetch(`${API_BASE}/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, password }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || `Erro ${res.status}`);
        return;
      }

      setRegistered(true);
      setEmailSent(data.emailSent);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro de conexão');
    } finally {
      setSubmitting(false);
    }
  };

  // Success state
  if (registered) {
    return (
      <div className="min-h-screen bg-dark-950 flex items-center justify-center p-8">
        <motion.div
          className="w-full max-w-md"
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.4 }}
        >
          <div className="card text-center">
            <div className="flex justify-center mb-6">
              <div className="w-16 h-16 rounded-full bg-keelo-500/20 flex items-center justify-center">
                {emailSent ? (
                  <Mail className="w-8 h-8 text-keelo-400" />
                ) : (
                  <CheckCircle className="w-8 h-8 text-keelo-400" />
                )}
              </div>
            </div>

            <h1 className="text-2xl font-bold text-dark-100 mb-2">
              {emailSent ? 'Verifique seu email' : 'Conta criada!'}
            </h1>

            {emailSent ? (
              <div className="space-y-4">
                <p className="text-dark-400">
                  Enviamos um link de confirmação para <span className="text-keelo-400 font-medium">{email}</span>.
                </p>
                <p className="text-dark-500 text-sm">
                  Clique no link do email para ativar sua conta. O link expira em 24 horas.
                </p>
                <p className="text-dark-600 text-xs">
                  Não recebeu? Verifique a caixa de spam ou{' '}
                  <button
                    onClick={async () => {
                      try {
                        await fetch(`${API_BASE}/auth/resend-verification`, {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({ email }),
                        });
                        setError('');
                      } catch {
                        // silent
                      }
                    }}
                    className="text-keelo-400 hover:text-keelo-300 underline"
                  >
                    reenvie o email
                  </button>
                  .
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                <p className="text-dark-400">
                  Sua conta foi criada. Contate o administrador para ativar seu acesso.
                </p>
              </div>
            )}

            <Link
              to="/login"
              className="inline-flex items-center gap-2 mt-6 text-sm text-keelo-400 hover:text-keelo-300 transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
              Voltar para o login
            </Link>
          </div>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-dark-950 flex items-center justify-center p-8">
      <motion.div
        className="w-full max-w-md"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        {/* Logo */}
        <div className="flex flex-col items-center justify-center gap-2 mb-8">
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
            <h1 className="text-2xl font-bold text-dark-100">Criar conta</h1>
            <p className="text-dark-400 mt-2">Preencha os dados para começar</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="name" className="block text-sm font-medium text-dark-300 mb-1.5">
                Nome
              </label>
              <input
                id="name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full px-4 py-2.5 bg-dark-800 border border-dark-600 rounded-lg text-dark-100 
                           placeholder-dark-500 focus:outline-none focus:border-keelo-500 focus:ring-1 focus:ring-keelo-500
                           transition-colors"
                placeholder="Seu nome completo"
                autoComplete="name"
                disabled={submitting}
              />
            </div>

            <div>
              <label htmlFor="email" className="block text-sm font-medium text-dark-300 mb-1.5">
                Email
              </label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-4 py-2.5 bg-dark-800 border border-dark-600 rounded-lg text-dark-100 
                           placeholder-dark-500 focus:outline-none focus:border-keelo-500 focus:ring-1 focus:ring-keelo-500
                           transition-colors"
                placeholder="seu@email.com"
                autoComplete="email"
                disabled={submitting}
              />
            </div>

            <div>
              <label htmlFor="register-password" className="block text-sm font-medium text-dark-300 mb-1.5">
                Senha
              </label>
              <div className="relative">
                <input
                  id="register-password"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full px-4 py-2.5 bg-dark-800 border border-dark-600 rounded-lg text-dark-100 
                             placeholder-dark-500 focus:outline-none focus:border-keelo-500 focus:ring-1 focus:ring-keelo-500
                             transition-colors pr-12"
                  placeholder="Mínimo 8 caracteres"
                  autoComplete="new-password"
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

            <div>
              <label htmlFor="confirm-password" className="block text-sm font-medium text-dark-300 mb-1.5">
                Confirmar senha
              </label>
              <input
                id="confirm-password"
                type={showPassword ? 'text' : 'password'}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="w-full px-4 py-2.5 bg-dark-800 border border-dark-600 rounded-lg text-dark-100 
                           placeholder-dark-500 focus:outline-none focus:border-keelo-500 focus:ring-1 focus:ring-keelo-500
                           transition-colors"
                placeholder="Repita a senha"
                autoComplete="new-password"
                disabled={submitting}
              />
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
                  <UserPlus className="w-5 h-5" />
                  Criar conta
                </>
              )}
            </button>
          </form>

          <div className="mt-6 text-center">
            <span className="text-dark-500 text-sm">Já tem uma conta? </span>
            <Link to="/login" className="text-sm text-keelo-400 hover:text-keelo-300 transition-colors font-medium">
              Faça login
            </Link>
          </div>
        </div>
      </motion.div>
    </div>
  );
}

