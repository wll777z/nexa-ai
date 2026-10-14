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
    <div className="min-h-screen flex items-center justify-center bg-surface-app px-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold text-ink-strong">NEXA AI</h1>
          <p className="text-ink-base text-sm mt-1">
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
              <label className="field-label">E-mail</label>
              <input
                className="field"
                type="email"
                value={form.email}
                onChange={(e) => update('email', e.target.value)}
                required
                placeholder="seu@email.com"
              />
            </div>

            <div>
              <label className="field-label">Senha</label>
              <input
                className="field"
                type="password"
                value={form.password}
                onChange={(e) => update('password', e.target.value)}
                required
                minLength={mode === 'register' ? 8 : 1}
                placeholder={mode === 'register' ? 'Mínimo 8 caracteres' : 'Sua senha'}
              />
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
      </div>
    </div>
  );
}
