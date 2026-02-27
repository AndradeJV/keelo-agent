import { useState } from 'react';
import { Link, useSearchParams, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Eye, EyeOff, KeyRound, CheckCircle } from 'lucide-react';

const API_BASE = import.meta.env.VITE_API_URL || '/api';

export default function ResetPassword() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const token = searchParams.get('token');

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!password.trim() || !confirmPassword.trim()) {
      setError('Preencha os dois campos');
      return;
    }

    if (password.length < 8) {
      setError('A senha deve ter pelo menos 8 caracteres');
      return;
    }

    if (password !== confirmPassword) {
      setError('As senhas não coincidem');
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch(`${API_BASE}/auth/reset-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, password }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || 'Falha ao redefinir senha');
        return;
      }

      setSuccess(true);
      // Redirect to login after 3 seconds
      setTimeout(() => navigate('/login?reset=true'), 3000);
    } catch {
      setError('Erro de conexão. Tente novamente.');
    } finally {
      setSubmitting(false);
    }
  };

  // No token in URL
  if (!token) {
    return (
      <div className="min-h-screen bg-dark-950 flex items-center justify-center p-8">
        <motion.div
          className="w-full max-w-md"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          <div className="card text-center py-8">
            <h1 className="text-2xl font-bold text-dark-100 mb-4">Link inválido</h1>
            <p className="text-dark-400 mb-6 text-sm">
              Este link de redefinição de senha é inválido ou expirou.
            </p>
            <Link to="/forgot-password" className="text-keelo-400 hover:text-keelo-300 text-sm font-medium">
              Solicitar novo link
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
        <div className="flex flex-col items-center justify-center gap-2 mb-8">
          <img
            src="/keelo-logo.svg"
            alt="Keelo"
            className="w-12 h-12 rounded-xl"
          />
          <span className="text-3xl font-bold gradient-text">Keelo</span>
          <span className="text-sm text-dark-400">QA Intelligence Platform</span>
        </div>

        <div className="card">
          {success ? (
            /* Success state */
            <div className="text-center py-4">
              <div className="w-16 h-16 mx-auto mb-4 bg-keelo-500/10 rounded-full flex items-center justify-center">
                <CheckCircle className="w-8 h-8 text-keelo-400" />
              </div>
              <h1 className="text-2xl font-bold text-dark-100 mb-2">Senha redefinida!</h1>
              <p className="text-dark-400 text-sm mb-6">
                Sua senha foi atualizada com sucesso. Redirecionando para o login...
              </p>
              <Link
                to="/login"
                className="text-keelo-400 hover:text-keelo-300 transition-colors text-sm font-medium"
              >
                Ir para o login agora
              </Link>
            </div>
          ) : (
            /* Form state */
            <>
              <div className="text-center mb-8">
                <h1 className="text-2xl font-bold text-dark-100">Nova senha</h1>
                <p className="text-dark-400 mt-2 text-sm">
                  Crie uma nova senha para sua conta.
                </p>
              </div>

              <form onSubmit={handleSubmit} className="space-y-4 mb-4">
                <div>
                  <label htmlFor="password" className="block text-sm font-medium text-dark-300 mb-1.5">
                    Nova senha
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
                      placeholder="Mínimo 8 caracteres"
                      autoComplete="new-password"
                      autoFocus
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
                    Confirmar nova senha
                  </label>
                  <div className="relative">
                    <input
                      id="confirm-password"
                      type={showConfirmPassword ? 'text' : 'password'}
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      className="w-full px-4 py-2.5 bg-dark-800 border border-dark-600 rounded-lg text-dark-100
                                 placeholder-dark-500 focus:outline-none focus:border-keelo-500 focus:ring-1 focus:ring-keelo-500
                                 transition-colors pr-12"
                      placeholder="Confirme sua nova senha"
                      autoComplete="new-password"
                      disabled={submitting}
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-dark-400 hover:text-dark-200 transition-colors"
                      tabIndex={-1}
                    >
                      {showConfirmPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
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
                      <KeyRound className="w-5 h-5" />
                      Redefinir senha
                    </>
                  )}
                </button>
              </form>

              <div className="text-center mt-6">
                <Link
                  to="/login"
                  className="text-dark-500 hover:text-dark-300 transition-colors text-sm"
                >
                  Voltar ao login
                </Link>
              </div>
            </>
          )}
        </div>
      </motion.div>
    </div>
  );
}

