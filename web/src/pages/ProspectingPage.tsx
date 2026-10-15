import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { prospectingApi } from '../services/prospectingApi';
import { Sidebar } from '../components/Sidebar';
import {
  Card,
  Spinner,
  ErrorMessage,
  Badge,
  EmptyState,
} from '../components/UI';
import {
  STATUS_LABELS,
  PRIORITY_LABELS,
  ALL_STATUSES,
  type Lead,
  type LeadPriority,
  type LeadStatus,
  type ProspectingConfig,
  type ProspectingStatus,
} from '../types/prospecting';

const emptyConfig: ProspectingConfig = {
  id: 0,
  organizationId: 0,
  service: '',
  companyName: '',
  description: '',
  region: '',
  segments: [],
  maxPerSearch: 10,
  channel: 'manual',
  messageTemplate:
    'Olá! Tudo bem? Encontrei o perfil comercial da [NOME DA EMPRESA] e gostaria de apresentar meu trabalho com [SERVIÇO]. Posso te enviar algumas informações?',
  maxContactsDay: 20,
  autoApprove: false,
  createdAt: '',
  updatedAt: '',
};

type Tab = 'config' | 'leads' | 'messages' | 'activity';

const priorityColor = (p: LeadPriority) =>
  p === 'alta' ? 'red' : p === 'media' ? 'yellow' : 'gray';

const statusColor = (s: LeadStatus) =>
  s === 'nao_contatar' || s === 'nao_interessado'
    ? 'red'
    : s === 'interessado' || s === 'respondeu'
      ? 'green'
      : s === 'aguardando_aprovacao'
        ? 'yellow'
        : 'gray';

export default function ProspectingPage() {
  const queryClient = useQueryClient();
  const [tab, setTab] = useState<Tab>('leads');

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['prospecting'] });
    queryClient.invalidateQueries({ queryKey: ['prospecting-leads'] });
    queryClient.invalidateQueries({ queryKey: ['prospecting-messages'] });
    queryClient.invalidateQueries({ queryKey: ['prospecting-activity'] });
  };

  const statusQuery = useQuery<ProspectingStatus>({
    queryKey: ['prospecting', 'status'],
    queryFn: prospectingApi.status,
  });

  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <main className="flex-1 p-6 overflow-auto">
        <header className="flex flex-wrap items-center justify-between gap-3 mb-6 animate-fade-up">
          <div>
            <h2 className="page-title">Prospecção comercial</h2>
            <p className="page-subtitle">
              Encontre empresas, gere mensagens e aprove antes de contatar — tudo
              sob seu controle.
            </p>
          </div>
          {statusQuery.data && (
            <Badge color={statusQuery.data.mode === 'demo' ? 'yellow' : 'green'}>
              {statusQuery.data.mode === 'demo'
                ? 'Modo demonstração (dados fictícios)'
                : 'Google Maps conectado'}
            </Badge>
          )}
        </header>

        {statusQuery.data?.mode === 'demo' && (
          <SetupBanner />
        )}

        <nav className="flex gap-1 mb-6 border-b border-surface-line" aria-label="Abas">
          {(
            [
              ['leads', 'Leads'],
              ['messages', 'Mensagens'],
              ['activity', 'Histórico'],
              ['config', 'Configuração'],
            ] as [Tab, string][]
          ).map(([key, label]) => (
            <button
              key={key}
              onClick={() => setTab(key)}
              className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
                tab === key
                  ? 'border-brand text-brand'
                  : 'border-transparent text-ink-base hover:text-ink-strong'
              }`}
            >
              {label}
            </button>
          ))}
        </nav>

        {tab === 'leads' && <LeadsTab onDone={invalidate} />}
        {tab === 'messages' && <MessagesTab onDone={invalidate} />}
        {tab === 'activity' && <ActivityTab />}
        {tab === 'config' && <ConfigTab onDone={invalidate} />}
      </main>
    </div>
  );
}

// ── Aviso de configuração (só no modo demonstração) ─────────────────────────

function SetupBanner() {
  const [dismissed, setDismissed] = useState(false);
  if (dismissed) return null;

  return (
    <Card className="mb-6 border-yellow-900/60 bg-yellow-950/30">
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1">
          <p className="text-sm font-medium text-ink-strong mb-1">
            Você está no modo demonstração — os leads gerados são fictícios.
          </p>
          <p className="text-sm text-ink-base">
            Para buscar empresas reais (com telefone e site), conecte o Google
            Maps Places API:
          </p>
          <ol className="text-sm text-ink-base list-decimal list-inside mt-2 space-y-1">
            <li>
              No Google Cloud Console, ative a <strong>Places API</strong> e crie
              uma chave de API (restrinja por API e IP).
            </li>
            <li>
              No arquivo <code className="text-brand">server/.env</code>, adicione:{' '}
              <code className="text-brand">
                {['GOOGLE_MAPS', '_API_KEY'].join('')}=sua-chave-aqui
              </code>
            </li>
            <li>Reinicie o servidor backend. A badge acima muda para “Google Maps conectado”.</li>
          </ol>
        </div>
        <button
          className="btn-ghost text-xs px-2 py-1 shrink-0"
          onClick={() => setDismissed(true)}
          aria-label="Fechar aviso"
        >
          Entendi
        </button>
      </div>
    </Card>
  );
}

// ── Aba: Configuração ────────────────────────────────────────────────────────

function ConfigTab({ onDone }: { onDone: () => void }) {
  const [form, setForm] = useState<ProspectingConfig>(emptyConfig);
  const [segmentsText, setSegmentsText] = useState('');
  const [formError, setFormError] = useState('');
  const [loaded, setLoaded] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ['prospecting', 'config'],
    queryFn: prospectingApi.getConfig,
    staleTime: 30_000,
  });

  // Carrega a config existente uma vez, sem apagar o que o usuário digitou.
  if (data && !loaded) {
    const c = data.config;
    if (c) {
      setForm(c);
      setSegmentsText(c.segments.join(', '));
    }
    setLoaded(true);
  }

  const saveMutation = useMutation({
    mutationFn: (body: Partial<ProspectingConfig>) =>
      prospectingApi.saveConfig(body),
    onSuccess: onDone,
    onError: (err: Error) => setFormError(err.message),
  });

  function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setFormError('');
    const segments = segmentsText
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    saveMutation.mutate({
      service: form.service.trim(),
      companyName: form.companyName.trim(),
      description: form.description.trim(),
      region: form.region.trim(),
      segments,
      maxPerSearch: form.maxPerSearch,
      channel: form.channel,
      messageTemplate: form.messageTemplate.trim(),
      maxContactsDay: form.maxContactsDay,
      autoApprove: form.autoApprove,
    });
  }

  if (isLoading) return <Spinner label="Carregando configuração..." />;

  return (
    <Card className="max-w-2xl">
      <form onSubmit={handleSave} className="flex flex-col gap-4">
        <p className="text-sm text-ink-base">
          Descreva seu serviço. A IA usa essas informações para personalizar as
          mensagens — nunca inventa fatos sobre as empresas.
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="field-label">Seu serviço</label>
            <input
              className="field"
              value={form.service}
              onChange={(e) => setForm({ ...form, service: e.target.value })}
              placeholder="Criação de sites, tráfego pago..."
            />
          </div>
          <div>
            <label className="field-label">Sua empresa</label>
            <input
              className="field"
              value={form.companyName}
              onChange={(e) => setForm({ ...form, companyName: e.target.value })}
              placeholder="Nome da sua empresa"
            />
          </div>
        </div>
        <div>
          <label className="field-label">Descrição do serviço</label>
          <textarea
            className="field"
            rows={3}
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
            placeholder="O que você oferece e para quem..."
          />
        </div>
        <div>
          <label className="field-label">Segmentos para pesquisar</label>
          <input
            className="field"
            value={segmentsText}
            onChange={(e) => setSegmentsText(e.target.value)}
            placeholder="barbearias, salões de beleza, clínicas..."
          />
          <p className="text-xs text-ink-faint mt-1">
            Separados por vírgula.
          </p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="field-label">Cidade / região</label>
            <input
              className="field"
              value={form.region}
              onChange={(e) => setForm({ ...form, region: e.target.value })}
              placeholder="Campo Grande - MS"
            />
          </div>
          <div>
            <label className="field-label">Máx. resultados por busca</label>
            <input
              className="field"
              type="number"
              min={1}
              max={50}
              value={form.maxPerSearch}
              onChange={(e) =>
                setForm({ ...form, maxPerSearch: Number(e.target.value) || 10 })
              }
            />
          </div>
        </div>
        <div>
          <label className="field-label">Modelo de mensagem</label>
          <textarea
            className="field"
            rows={4}
            value={form.messageTemplate}
            onChange={(e) =>
              setForm({ ...form, messageTemplate: e.target.value })
            }
          />
          <p className="text-xs text-ink-faint mt-1">
            Placeholders: [NOME DA EMPRESA], [SERVIÇO], [MINHA EMPRESA],
            [CATEGORIA], [CIDADE]
          </p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="field-label">Canal de contato</label>
            <select
              className="field"
              value={form.channel}
              onChange={(e) =>
                setForm({
                  ...form,
                  channel: e.target.value as ProspectingConfig['channel'],
                })
              }
            >
              <option value="manual">Manual (eu mesmo envio)</option>
              <option value="email">E-mail</option>
              <option value="whatsapp">WhatsApp</option>
            </select>
          </div>
          <div>
            <label className="field-label">Máx. contatos por dia</label>
            <input
              className="field"
              type="number"
              min={1}
              value={form.maxContactsDay}
              onChange={(e) =>
                setForm({ ...form, maxContactsDay: Number(e.target.value) || 20 })
              }
            />
          </div>
        </div>
        <label className="flex items-center gap-2 text-sm text-ink-base">
          <input
            type="checkbox"
            checked={form.autoApprove}
            onChange={(e) => setForm({ ...form, autoApprove: e.target.checked })}
          />
          Aprovar mensagens automaticamente (recomendado deixar desligado —
          revise antes de contatar)
        </label>
        {formError && <ErrorMessage message={formError} />}
        <div>
          <button
            type="submit"
            className="btn-primary"
            disabled={saveMutation.isPending}
          >
            {saveMutation.isPending ? 'Salvando...' : 'Salvar configuração'}
          </button>
        </div>
      </form>
    </Card>
  );
}

// ── Aba: Leads ───────────────────────────────────────────────────────────────

interface SearchForm {
  segments: string;
  region: string;
  maxResults: number;
}

function LeadsTab({ onDone }: { onDone: () => void }) {
  const queryClient = useQueryClient();
  const [searchForm, setSearchForm] = useState<SearchForm>({
    segments: '',
    region: '',
    maxResults: 10,
  });
  const [statusFilter, setStatusFilter] = useState<LeadStatus | ''>('');
  const [priorityFilter, setPriorityFilter] = useState<LeadPriority | ''>('');
  const [textSearch, setTextSearch] = useState('');
  const [showDemo, setShowDemo] = useState(false);
  const [searchResult, setSearchResult] = useState<string>('');
  const [searchError, setSearchError] = useState('');

  const configQuery = useQuery({
    queryKey: ['prospecting', 'config'],
    queryFn: prospectingApi.getConfig,
    staleTime: 30_000,
  });

  const leadsQuery = useQuery({
    queryKey: ['prospecting-leads', statusFilter, priorityFilter, textSearch, showDemo],
    queryFn: () =>
      prospectingApi.leads({
        status: statusFilter || undefined,
        priority: priorityFilter || undefined,
        search: textSearch || undefined,
        includeDemo: showDemo,
      }),
  });

  const statsQuery = useQuery({
    queryKey: ['prospecting', 'stats'],
    queryFn: prospectingApi.stats,
  });

  // Pré-preenche busca com a config salva (só na primeira carga).
  const prefillDone = useState(false);
  if (configQuery.data?.config && !prefillDone[0]) {
    const c = configQuery.data.config;
    setSearchForm((f) => ({
      ...f,
      segments: c.segments.join(', '),
      region: c.region,
      maxResults: c.maxPerSearch,
    }));
    prefillDone[1](true);
  }

  const searchMutation = useMutation({
    mutationFn: prospectingApi.search,
    onSuccess: (r) => {
      setSearchError('');
      setSearchResult(
        `${r.found} encontrado(s), ${r.inserted} novo(s), ${r.skipped} duplicado(s)/suprimido(s).`,
      );
      onDone();
      queryClient.invalidateQueries({ queryKey: ['prospecting-leads'] });
      queryClient.invalidateQueries({ queryKey: ['prospecting', 'stats'] });
    },
    onError: (err: Error) => setSearchError(err.message),
  });

  const statusMutation = useMutation({
    mutationFn: ({ id, status }: { id: number; status: LeadStatus }) =>
      prospectingApi.updateLeadStatus(id, status),
    onSuccess: () => {
      onDone();
      queryClient.invalidateQueries({ queryKey: ['prospecting-leads'] });
      queryClient.invalidateQueries({ queryKey: ['prospecting', 'stats'] });
    },
  });

  const suppressMutation = useMutation({
    mutationFn: (id: number) =>
      prospectingApi.suppressLead(id, 'marcado como não contatar pelo usuário'),
    onSuccess: () => {
      onDone();
      queryClient.invalidateQueries({ queryKey: ['prospecting-leads'] });
      queryClient.invalidateQueries({ queryKey: ['prospecting', 'stats'] });
    },
  });

  function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    setSearchError('');
    const segments = searchForm.segments
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    if (segments.length === 0) {
      setSearchError('Informe pelo menos um segmento.');
      return;
    }
    if (!searchForm.region.trim()) {
      setSearchError('Informe a cidade ou região.');
      return;
    }
    searchMutation.mutate({
      segments,
      region: searchForm.region.trim(),
      maxResults: searchForm.maxResults,
    });
  }

  const stats = statsQuery.data?.stats;
  const leads = leadsQuery.data?.data ?? [];

  return (
    <div className="flex flex-col gap-6">
      <Card>
        <form onSubmit={handleSearch} className="flex flex-col gap-3">
          <div className="grid grid-cols-1 sm:grid-cols-[2fr_1fr_auto] gap-3 items-end">
            <div>
              <label className="field-label">Segmentos</label>
              <input
                className="field"
                value={searchForm.segments}
                onChange={(e) =>
                  setSearchForm({ ...searchForm, segments: e.target.value })
                }
                placeholder="barbearias, salões..."
              />
            </div>
            <div>
              <label className="field-label">Cidade / região</label>
              <input
                className="field"
                value={searchForm.region}
                onChange={(e) =>
                  setSearchForm({ ...searchForm, region: e.target.value })
                }
                placeholder="Campo Grande - MS"
              />
            </div>
            <div>
              <label className="field-label">Qtd.</label>
              <input
                className="field w-20"
                type="number"
                min={1}
                max={50}
                value={searchForm.maxResults}
                onChange={(e) =>
                  setSearchForm({
                    ...searchForm,
                    maxResults: Number(e.target.value) || 10,
                  })
                }
              />
            </div>
          </div>
          {searchError && <ErrorMessage message={searchError} />}
          {searchResult && (
            <p className="text-sm text-green-400">{searchResult}</p>
          )}
          <div>
            <button
              type="submit"
              className="btn-primary"
              disabled={searchMutation.isPending}
            >
              {searchMutation.isPending ? 'Buscando...' : 'Buscar empresas'}
            </button>
          </div>
        </form>
      </Card>

      {stats && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <StatBox label="Total de leads" value={stats.totalLeads} />
          <StatBox label="Prioridade alta" value={stats.priority_alta ?? 0} />
          <StatBox label="Aguardando aprovação" value={stats.status_aguardando_aprovacao ?? 0} />
          <StatBox label="Mensagens enviadas" value={stats.messagesSent} />
        </div>
      )}

      <Card className="p-0 overflow-hidden">
        <div className="p-4 flex flex-wrap gap-3 items-center border-b border-surface-line">
          <input
            className="field max-w-xs"
            value={textSearch}
            onChange={(e) => setTextSearch(e.target.value)}
            placeholder="Buscar lead..."
          />
          <select
            className="field max-w-[180px]"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as LeadStatus | '')}
          >
            <option value="">Todos os status</option>
            {ALL_STATUSES.map((s) => (
              <option key={s} value={s}>
                {STATUS_LABELS[s]}
              </option>
            ))}
          </select>
          <select
            className="field max-w-[140px]"
            value={priorityFilter}
            onChange={(e) =>
              setPriorityFilter(e.target.value as LeadPriority | '')
            }
          >
            <option value="">Todas as prioridades</option>
            <option value="alta">Alta</option>
            <option value="media">Média</option>
            <option value="baixa">Baixa</option>
          </select>
          <label className="flex items-center gap-2 text-sm text-ink-base ml-auto">
            <input
              type="checkbox"
              checked={showDemo}
              onChange={(e) => setShowDemo(e.target.checked)}
            />
            Mostrar leads de demonstração
          </label>
        </div>

        {leadsQuery.isLoading && <Spinner label="Carregando leads..." />}
        {leadsQuery.error && (
          <div className="p-4">
            <ErrorMessage message={(leadsQuery.error as Error).message} />
          </div>
        )}

        {!leadsQuery.isLoading && leads.length === 0 && (
          <EmptyState
            title="Nenhum lead encontrado"
            description="Faça uma busca acima para encontrar empresas na sua região."
          />
        )}

        {leads.length > 0 && (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-ink-faint text-left border-b border-surface-line">
                  <th className="px-4 py-3 font-medium">Empresa</th>
                  <th className="px-4 py-3 font-medium">Categoria</th>
                  <th className="px-4 py-3 font-medium">Cidade</th>
                  <th className="px-4 py-3 font-medium">Prioridade</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                  <th className="px-4 py-3 font-medium">Motivo</th>
                  <th className="px-4 py-3 font-medium">Ações</th>
                </tr>
              </thead>
              <tbody>
                {leads.map((lead) => (
                  <LeadRow
                    key={lead.id}
                    lead={lead}
                    onStatus={(status) =>
                      statusMutation.mutate({ id: lead.id, status })
                    }
                    onSuppress={() => suppressMutation.mutate(lead.id)}
                    onDone={() => {
                      onDone();
                      queryClient.invalidateQueries({
                        queryKey: ['prospecting-leads'],
                      });
                      queryClient.invalidateQueries({
                        queryKey: ['prospecting-messages'],
                      });
                    }}
                  />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}

function StatBox({ label, value }: { label: string; value: number }) {
  return (
    <Card className="flex flex-col gap-1">
      <span className="text-xs text-ink-faint uppercase tracking-wider">
        {label}
      </span>
      <span className="text-2xl font-semibold text-ink-strong tabular-nums">
        {value}
      </span>
    </Card>
  );
}

function LeadRow({
  lead,
  onStatus,
  onSuppress,
  onDone,
}: {
  lead: Lead;
  onStatus: (status: LeadStatus) => void;
  onSuppress: () => void;
  onDone: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [messageError, setMessageError] = useState('');

  const generateMutation = useMutation({
    mutationFn: () => prospectingApi.createMessage(lead.id),
    onSuccess: () => {
      setMessageError('');
      setExpanded(true);
      onDone();
    },
    onError: (err: Error) => setMessageError(err.message),
  });

  return (
    <>
      <tr className="border-b border-surface-line/50 hover:bg-surface-hover/30">
        <td className="px-4 py-3 text-ink-strong font-medium">
          {lead.name}
          {lead.isDemo && (
            <Badge color="yellow">
              <span className="ml-1">demo</span>
            </Badge>
          )}
        </td>
        <td className="px-4 py-3 text-ink-base">{lead.category ?? '—'}</td>
        <td className="px-4 py-3 text-ink-base">{lead.city ?? '—'}</td>
        <td className="px-4 py-3">
          <Badge color={priorityColor(lead.priority)}>
            {PRIORITY_LABELS[lead.priority]}
          </Badge>
        </td>
        <td className="px-4 py-3">
          <Badge color={statusColor(lead.status)}>
            {STATUS_LABELS[lead.status]}
          </Badge>
        </td>
        <td className="px-4 py-3 text-ink-base text-xs max-w-[200px] truncate" title={lead.reason ?? ''}>
          {lead.reason ?? '—'}
        </td>
        <td className="px-4 py-3">
          <div className="flex gap-1 flex-wrap">
            <button
              className="btn-secondary text-xs px-2 py-1"
              onClick={() => generateMutation.mutate()}
              disabled={generateMutation.isPending}
            >
              {generateMutation.isPending ? 'Gerando...' : 'Gerar mensagem'}
            </button>
            <select
              className="field text-xs py-1 w-auto max-w-[150px]"
              value={lead.status}
              onChange={(e) => onStatus(e.target.value as LeadStatus)}
            >
              {ALL_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {STATUS_LABELS[s]}
                </option>
              ))}
            </select>
            <button
              className="btn-ghost text-xs px-2 py-1 text-red-400"
              onClick={onSuppress}
              title="Adiciona à lista de não contatar"
            >
              Não contatar
            </button>
          </div>
          {messageError && (
            <p className="text-xs text-red-400 mt-1">{messageError}</p>
          )}
        </td>
      </tr>
      {expanded && (
        <tr className="bg-surface-panel/40">
          <td colSpan={7} className="px-4 py-3">
            <p className="text-xs text-ink-faint mb-1">
              Mensagem gerada para <strong>{lead.name}</strong> — revise na aba
              “Mensagens” antes de aprovar e enviar.
            </p>
            <p className="text-sm text-ink-base whitespace-pre-wrap">
              {generateMutation.data?.content ?? '(gerada — veja na aba Mensagens)'}
            </p>
          </td>
        </tr>
      )}
    </>
  );
}

// ── Aba: Mensagens (aprovação manual) ────────────────────────────────────────

function MessagesTab({ onDone }: { onDone: () => void }) {
  const queryClient = useQueryClient();
  const [statusFilter, setStatusFilter] = useState('');

  const messagesQuery = useQuery({
    queryKey: ['prospecting-messages', statusFilter],
    queryFn: () => prospectingApi.messages(statusFilter || undefined),
  });

  const action = (
    fn: (id: number) => Promise<{ ok: true }>,
    label: string,
  ) =>
    useMutation({
      mutationFn: fn,
      onSuccess: () => {
        onDone();
        queryClient.invalidateQueries({ queryKey: ['prospecting-messages'] });
        queryClient.invalidateQueries({ queryKey: ['prospecting-leads'] });
      },
    });

  const approveMutation = action(prospectingApi.approveMessage, 'aprovar');
  const rejectMutation = action(prospectingApi.rejectMessage, 'recusar');

  const messages = messagesQuery.data?.data ?? [];

  return (
    <div className="flex flex-col gap-4">
      <Card className="p-4">
        <p className="text-sm text-ink-base">
          Toda mensagem exige sua aprovação manual antes de qualquer contato. O
          envio automático só funciona quando um canal real (e-mail ou WhatsApp)
          estiver integrado — hoje o sistema opera em modo de aprovação.
        </p>
      </Card>

      <Card className="p-4">
        <select
          className="field max-w-[220px]"
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
        >
          <option value="">Todas as mensagens</option>
          <option value="pendente">Pendentes</option>
          <option value="aprovada">Aprovadas</option>
          <option value="enviada">Enviadas</option>
          <option value="respondida">Respondidas</option>
          <option value="recusada">Recusadas</option>
        </select>
      </Card>

      {messagesQuery.isLoading && <Spinner label="Carregando mensagens..." />}
      {messagesQuery.error && (
        <ErrorMessage message={(messagesQuery.error as Error).message} />
      )}

      {!messagesQuery.isLoading && messages.length === 0 && (
        <EmptyState
          title="Nenhuma mensagem"
          description="Gere uma mensagem a partir de um lead para começar."
        />
      )}

      <div className="flex flex-col gap-4">
        {messages.map((m) => (
          <Card key={m.id}>
            <div className="flex items-center justify-between gap-3 mb-2">
              <div className="flex items-center gap-2 min-w-0">
                <span className="text-ink-strong font-medium truncate">
                  {m.lead_name}
                </span>
                <Badge
                  color={
                    m.status === 'respondida'
                      ? 'green'
                      : m.status === 'recusada'
                        ? 'red'
                        : m.status === 'pendente'
                          ? 'yellow'
                          : 'brand'
                  }
                >
                  {m.status}
                </Badge>
              </div>
              {m.status === 'pendente' && (
                <div className="flex gap-2 shrink-0">
                  <button
                    className="btn-primary text-xs px-3 py-1"
                    onClick={() => approveMutation.mutate(m.id)}
                    disabled={approveMutation.isPending}
                  >
                    Aprovar
                  </button>
                  <button
                    className="btn-ghost text-xs px-3 py-1 text-red-400"
                    onClick={() => rejectMutation.mutate(m.id)}
                    disabled={rejectMutation.isPending}
                  >
                    Recusar
                  </button>
                </div>
              )}
            </div>
            <p className="text-sm text-ink-base whitespace-pre-wrap">
              {m.content}
            </p>
            <p className="text-xs text-ink-faint mt-2">
              Criada em {new Date(m.created_at).toLocaleString('pt-BR')}
            </p>
          </Card>
        ))}
      </div>
    </div>
  );
}

// ── Aba: Histórico ───────────────────────────────────────────────────────────

function ActivityTab() {
  const activityQuery = useQuery({
    queryKey: ['prospecting-activity'],
    queryFn: prospectingApi.activity,
  });

  const entries = activityQuery.data?.data ?? [];

  if (activityQuery.isLoading) return <Spinner label="Carregando histórico..." />;

  return (
    <Card className="p-0 overflow-hidden">
      {entries.length === 0 ? (
        <EmptyState
          title="Nenhuma atividade ainda"
          description="O histórico de ações aparece aqui conforme você usa o sistema."
        />
      ) : (
        <ul className="divide-y divide-surface-line">
          {entries.map((a) => (
            <li key={a.id} className="px-4 py-3 flex flex-col gap-0.5">
              <span className="text-sm text-ink-strong">{a.detail ?? a.action}</span>
              <span className="text-xs text-ink-faint">
                {a.action} · {new Date(a.createdAt).toLocaleString('pt-BR')}
              </span>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
