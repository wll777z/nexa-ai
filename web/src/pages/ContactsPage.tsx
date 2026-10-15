import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../services/api';
import { Sidebar } from '../components/Sidebar';
import { Card, Spinner, ErrorMessage, Badge, EmptyState } from '../components/UI';

interface Contact {
  id: number;
  name: string;
  phone: string | null;
  email: string | null;
  company: string | null;
  source: string | null;
  stage: string;
  consent: number;
  opt_out: number;
  tags: string[];
  created_at: string;
}

interface ContactsResponse {
  data: Contact[];
  total: number;
}

const stageLabels: Record<string, string> = {
  new_lead: 'Novo lead',
  first_contact: 'Primeiro contato',
  in_service: 'Em atendimento',
  qualified: 'Qualificado',
  quote_sent: 'Orçamento enviado',
  awaiting_reply: 'Aguardando resposta',
  negotiation: 'Negociação',
  converted: 'Convertido',
  lost: 'Perdido',
};

interface NewContactForm {
  name: string;
  phone: string;
  email: string;
  company: string;
  source: string;
  consent: boolean;
  tags: string;
}

const emptyForm: NewContactForm = {
  name: '',
  phone: '',
  email: '',
  company: '',
  source: '',
  consent: false,
  tags: '',
};

export default function ContactsPage() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<NewContactForm>(emptyForm);
  const [formError, setFormError] = useState('');

  const { data, isLoading, error } = useQuery<ContactsResponse>({
    queryKey: ['contacts', search],
    queryFn: () =>
      api.get(`/contacts${search ? `?q=${encodeURIComponent(search)}` : ''}`),
  });

  const createMutation = useMutation({
    mutationFn: (body: Record<string, unknown>) => api.post('/contacts', body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['contacts'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      setShowForm(false);
      setForm(emptyForm);
      setFormError('');
    },
    onError: (err: Error) => setFormError(err.message),
  });

  function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setFormError('');
    const body: Record<string, unknown> = {
      name: form.name.trim(),
      consent: form.consent,
    };
    if (form.phone.trim()) body.phone = form.phone.trim();
    if (form.email.trim()) body.email = form.email.trim();
    if (form.company.trim()) body.company = form.company.trim();
    if (form.source.trim()) body.source = form.source.trim();
    if (form.tags.trim()) {
      body.tags = form.tags.split(',').map((t) => t.trim()).filter(Boolean);
    }
    createMutation.mutate(body);
  }

  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <main className="flex-1 p-6 overflow-auto">
        <header className="flex flex-wrap items-center justify-between gap-3 mb-6 animate-fade-up">
          <div>
            <h2 className="page-title">Clientes e contatos</h2>
            <p className="page-subtitle">
              {data ? `${data.total} contato(s) cadastrado(s)` : 'Carregando...'}
            </p>
          </div>
          <button
            className="btn-primary"
            onClick={() => setShowForm(!showForm)}
          >
            {showForm ? 'Cancelar' : 'Novo contato'}
          </button>
        </header>

        {showForm && (
          <Card className="mb-6">
            <form onSubmit={handleCreate} className="flex flex-col gap-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="field-label">Nome *</label>
                  <input
                    className="field"
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    required
                    minLength={2}
                    placeholder="Nome completo"
                  />
                </div>
                <div>
                  <label className="field-label">Telefone</label>
                  <input
                    className="field"
                    value={form.phone}
                    onChange={(e) => setForm({ ...form, phone: e.target.value })}
                    placeholder="(11) 99999-8888"
                  />
                </div>
                <div>
                  <label className="field-label">E-mail</label>
                  <input
                    className="field"
                    type="email"
                    value={form.email}
                    onChange={(e) => setForm({ ...form, email: e.target.value })}
                    placeholder="email@exemplo.com"
                  />
                </div>
                <div>
                  <label className="field-label">Empresa</label>
                  <input
                    className="field"
                    value={form.company}
                    onChange={(e) => setForm({ ...form, company: e.target.value })}
                    placeholder="Nome da empresa"
                  />
                </div>
                <div>
                  <label className="field-label">Origem</label>
                  <input
                    className="field"
                    value={form.source}
                    onChange={(e) => setForm({ ...form, source: e.target.value })}
                    placeholder="site, indicação, evento..."
                  />
                </div>
                <div>
                  <label className="field-label">Etiquetas (separadas por vírgula)</label>
                  <input
                    className="field"
                    value={form.tags}
                    onChange={(e) => setForm({ ...form, tags: e.target.value })}
                    placeholder="VIP, Site, Urgente"
                  />
                </div>
              </div>
              <label className="flex items-center gap-2 text-sm text-ink-base">
                <input
                  type="checkbox"
                  checked={form.consent}
                  onChange={(e) => setForm({ ...form, consent: e.target.checked })}
                  className="rounded border-surface-line"
                />
                Consentimento para receber comunicações
              </label>
              {formError && <ErrorMessage message={formError} />}
              <div>
                <button
                  type="submit"
                  className="btn-primary"
                  disabled={createMutation.isPending}
                >
                  {createMutation.isPending ? 'Salvando...' : 'Salvar contato'}
                </button>
              </div>
            </form>
          </Card>
        )}

        <Card className="mb-4">
          <input
            className="field"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por nome, telefone ou e-mail..."
          />
        </Card>

        {isLoading && <Spinner />}
        {error && <ErrorMessage message={(error as Error).message} />}

        {data && data.data.length === 0 && (
          <EmptyState
            title="Nenhum contato encontrado"
            description={
              search
                ? 'Tente ajustar a busca ou cadastre um novo contato.'
                : 'Comece cadastrando seu primeiro contato.'
            }
          />
        )}

        {data && data.data.length > 0 && (
          <Card className="p-0 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-ink-faint text-left border-b border-surface-line">
                    <th className="px-4 py-3 font-medium">Nome</th>
                    <th className="px-4 py-3 font-medium">Telefone</th>
                    <th className="px-4 py-3 font-medium">E-mail</th>
                    <th className="px-4 py-3 font-medium">Etapa</th>
                    <th className="px-4 py-3 font-medium">Etiquetas</th>
                    <th className="px-4 py-3 font-medium">Consent.</th>
                  </tr>
                </thead>
                <tbody>
                  {data.data.map((c) => (
                    <tr
                      key={c.id}
                      className="border-b border-surface-line/50 hover:bg-surface-hover/30"
                    >
                      <td className="px-4 py-3 text-ink-strong font-medium">{c.name}</td>
                      <td className="px-4 py-3 text-ink-base">{c.phone ?? '—'}</td>
                      <td className="px-4 py-3 text-ink-base">{c.email ?? '—'}</td>
                      <td className="px-4 py-3">
                        <Badge color="brand">{stageLabels[c.stage] ?? c.stage}</Badge>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex gap-1 flex-wrap">
                          {c.tags.map((t) => (
                            <Badge key={t}>{t}</Badge>
                          ))}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        {c.opt_out === 1 ? (
                          <Badge color="red">Opt-out</Badge>
                        ) : c.consent === 1 ? (
                          <Badge color="green">Sim</Badge>
                        ) : (
                          <Badge color="yellow">Não</Badge>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        )}
      </main>
    </div>
  );
}
