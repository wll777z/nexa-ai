import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { Card, ErrorMessage } from '../components/UI';

type Mode = 'login' | 'register';

export default function LoginPage() {
  const { login, register } = useAuth();
  const navigate = useNavigate();
  const [mode, setMode] = useState<Mode>('login');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const [form, setForm] = useState({
    name: '',
    email: '',
    password: '',
    organizationName: '',
  });
  const [showPassword, setShowPassword] = useState(false);

  function update(field: string, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      if (mode === 'login') {
        await login(form.email, form.password);
      } else {
        await register(form);
      }
      navigate('/');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro inesperado.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-surface-app px-4 py-10">
      {/* Fundo decorativo discreto — glow suave da marca, sem exagero */}
      <div
        className="pointer-events-none fixed inset-0 opacity-40"
        style={{
          background:
            'radial-gradient(600px 320px at 50% -60px, rgb(99 102 241 / 0.18), transparent 70%)',
        }}
        aria-hidden="true"
      />
      <div className="w-full max-w-md relative animate-fade-up">
        <div className="text-center mb-8">
          <div
            className="w-12 h-12 rounded-xl bg-brand mx-auto mb-4 flex items-center justify-center text-white text-xl font-bold shadow-lg shadow-brand/30"
            aria-hidden="true"
          >
            N
          </div>
          <h1 className="text-2xl font-bold text-ink-strong">NEXA AI</h1>
          <p className="text-ink-base text-sm mt-1.5">
            Plataforma de inteligência comercial
          </p>
        </div>

        <Card>
          <div className="flex gap-2 mb-5">
            <button
              type="button"
              onClick={() => { setMode('login'); setError(''); }}
              className={`flex-1 py-2 text-sm rounded-lg transition-colors ${
                mode === 'login'
                  ? 'bg-brand text-white'
                  : 'bg-surface-hover text-ink-base'
              }`}
            >
              Entrar
            </button>
            <button
              type="button"
              onClick={() => { setMode('register'); setError(''); }}
              className={`flex-1 py-2 text-sm rounded-lg transition-colors ${
                mode === 'register'
                  ? 'bg-brand text-white'
                  : 'bg-surface-hover text-ink-base'
              }`}
            >
              Criar conta
            </button>
          </div>

          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            {mode === 'register' && (
              <>
                <div>
                  <label className="field-label">Nome</label>
                  <input
                    className="field"
                    value={form.name}
                    onChange={(e) => update('name', e.target.value)}
                    required
                    minLength={2}
                    placeholder="Seu nome completo"
                  />
                </div>
                <div>
                  <label className="field-label">Empresa</label>
                  <input
                    className="field"
                    value={form.organizationName}
                    onChange={(e) => update('organizationName', e.target.value)}
                    required
                    minLength={2}
                    placeholder="Nome da empresa"
                  />
                </div>
              </>
            )}

            <div>
              <label className="field-label" htmlFor="login-email">E-mail</label>
              <input
                id="login-email"
                className="field"
                type="email"
                value={form.email}
                onChange={(e) => update('email', e.target.value)}
                required
                autoComplete="email"
                placeholder="seu@email.com"
              />
            </div>

            <div>
              <label className="field-label" htmlFor="login-password">Senha</label>
              <div className="relative">
                <input
                  id="login-password"
                  className="field pr-16"
                  type={showPassword ? 'text' : 'password'}
                  value={form.password}
                  onChange={(e) => update('password', e.target.value)}
                  required
                  autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                  minLength={mode === 'register' ? 8 : 1}
                  placeholder={mode === 'register' ? 'Mínimo 8 caracteres' : 'Sua senha'}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-ink-faint hover:text-ink-base px-2 py-1 rounded transition-colors"
                  aria-label={showPassword ? 'Ocultar senha' : 'Mostrar senha'}
                >
                  {showPassword ? 'Ocultar' : 'Mostrar'}
                </button>
              </div>
            </div>

            {error && <ErrorMessage message={error} />}

            <button type="submit" className="btn-primary w-full" disabled={loading}>
              {loading
                ? 'Aguarde...'
                : mode === 'login'
                  ? 'Entrar'
                  : 'Criar conta'}
            </button>
          </form>
        </Card>

        <p className="text-center text-xs text-ink-faint mt-6">
          {mode === 'login' ? (
            <>
              Ainda não tem conta?{' '}
              <button
                type="button"
                onClick={() => { setMode('register'); setError(''); }}
                className="text-brand hover:text-brand-hover font-medium transition-colors"
              >
                Criar conta
              </button>
            </>
          ) : (
            <>
              Já tem conta?{' '}
              <button
                type="button"
                onClick={() => { setMode('login'); setError(''); }}
                className="text-brand hover:text-brand-hover font-medium transition-colors"
              >
                Entrar
              </button>
            </>
          )}
        </p>
      </div>
    </div>
  );
}
