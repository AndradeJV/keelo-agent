import { useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Mail, ArrowLeft } from 'lucide-react';

const API_BASE = import.meta.env.VITE_API_URL || '/api';

export default function ForgotPassword() {
  const [email, setEmail] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!email.trim()) {
      setError('Digite seu email');
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch(`${API_BASE}/auth/forgot-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || 'Falha ao enviar email');
        return;
      }

      setSent(true);
    } catch {
      setError('Erro de conexão. Tente novamente.');
    } finally {
      setSubmitting(false);
    }
  };

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
          {sent ? (
            /* Success state */
            <div className="text-center py-4">
              <div className="w-16 h-16 mx-auto mb-4 bg-keelo-500/10 rounded-full flex items-center justify-center">
                <Mail className="w-8 h-8 text-keelo-400" />
              </div>
              <h1 className="text-2xl font-bold text-dark-100 mb-2">Email enviado!</h1>
              <p className="text-dark-400 text-sm mb-6">
                Se o email <span className="text-dark-200 font-medium">{email}</span> estiver
                cadastrado, você receberá um link para redefinir sua senha. Verifique também a pasta de spam.
              </p>
              <Link
                to="/login"
                className="inline-flex items-center gap-2 text-keelo-400 hover:text-keelo-300 transition-colors text-sm font-medium"
              >
                <ArrowLeft className="w-4 h-4" />
                Voltar ao login
              </Link>
            </div>
          ) : (
            /* Form state */
            <>
              <div className="text-center mb-8">
                <h1 className="text-2xl font-bold text-dark-100">Esqueci minha senha</h1>
                <p className="text-dark-400 mt-2 text-sm">
                  Digite seu email e enviaremos um link para redefinir sua senha.
                </p>
              </div>

              <form onSubmit={handleSubmit} className="space-y-4 mb-4">
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
                    autoFocus
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
                      <Mail className="w-5 h-5" />
                      Enviar link de redefinição
                    </>
                  )}
                </button>
              </form>

              <div className="text-center mt-6">
                <Link
                  to="/login"
                  className="inline-flex items-center gap-2 text-dark-500 hover:text-dark-300 transition-colors text-sm"
                >
                  <ArrowLeft className="w-4 h-4" />
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

