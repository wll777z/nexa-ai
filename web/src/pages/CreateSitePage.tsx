import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../services/api';
import { Sidebar } from '../components/Sidebar';
import { Card, Spinner, ErrorMessage, Badge } from '../components/UI';
import { SitePreview } from '../components/SitePreview';
import { buildSiteHtml } from '../components/siteHtml';
import type { SiteContent, SiteBrief } from '../types/site';

// ── Modelos por segmento (miniatura + descrição) ────────────────────────────
interface ModelDef {
  id: string;
  label: string;
  desc: string;
  layout: string;
  colors: [string, string];
  brief: Partial<BriefForm>;
}

const MODELS: ModelDef[] = [
  {
    id: 'barbearia',
    label: 'Barbearia',
    desc: 'Clássico, destaque âmbar, agendamento',
    layout: 'barbearia',
    colors: ['#b45309', '#0c0a09'],
    brief: {
      segment: 'Barbearia',
      description: 'Barbearia com cortes masculinos, barba e atendimento por agendamento.',
      services: 'Corte masculino, Barba, Pigmentação, Agendamento',
      targetAudience: 'Homens, 18 a 45 anos',
    },
  },
  {
    id: 'salao',
    label: 'Salão de beleza',
    desc: 'Elegante, tons suaves, acolhedor',
    layout: 'salao',
    colors: ['#be185d', '#1c1917'],
    brief: {
      segment: 'Salão de beleza',
      description: 'Salão de beleza com cortes, coloração, manicure e estética.',
      services: 'Corte e escova, Coloração, Manicure e pedicure, Estética',
      targetAudience: 'Público feminino',
    },
  },
  {
    id: 'estetica',
    label: 'Estética',
    desc: 'Limpo, claro, cuidado e confiança',
    layout: 'salao',
    colors: ['#0d9488', '#f8fafc'],
    brief: {
      segment: 'Clínica de estética',
      description: 'Clínica de estética com limpeza de pele, massagem e tratamentos faciais.',
      services: 'Limpeza de pele, Massagem, Tratamentos faciais, Depilação',
      targetAudience: 'Público feminino e masculino',
    },
  },
  {
    id: 'restaurante',
    label: 'Restaurante',
    desc: 'Acolhedor, cores quentes, delivery',
    layout: 'restaurante',
    colors: ['#dc2626', '#1c1917'],
    brief: {
      segment: 'Restaurante',
      description: 'Restaurante de comida caseária com delivery e reservas.',
      services: 'Almoço, Jantar, Delivery, Reservas',
      targetAudience: 'Famílias e trabalhadores da região',
    },
  },
  {
    id: 'loja',
    label: 'Loja',
    desc: 'Moderno, vitrine, foco em produtos',
    layout: 'loja',
    colors: ['#7c3aed', '#0a0a0b'],
    brief: {
      segment: 'Loja',
      description: 'Loja com catálogo, vitrine online e contato por WhatsApp.',
      services: 'Catálogo de produtos, Vitrine online, Contato por WhatsApp',
      targetAudience: 'Público geral',
    },
  },
  {
    id: 'clinica',
    label: 'Clínica',
    desc: 'Limpo, transmite confiança',
    layout: 'clinica',
    colors: ['#0ea5e9', '#f8fafc'],
    brief: {
      segment: 'Clínica',
      description: 'Clínica com consultas, exames e agendamento online.',
      services: 'Consultas, Exames, Agendamento online',
      targetAudience: 'Pacientes em geral',
    },
  },
  {
    id: 'servico',
    label: 'Prestador de serviços',
    desc: 'Direto, orçamento, área de atendimento',
    layout: 'servico',
    colors: ['#334155', '#f8fafc'],
    brief: {
      segment: 'Serviços',
      description: 'Prestador de serviços com orçamento por WhatsApp e área de atendimento.',
      services: 'Orçamento sem compromisso, Atendimento, Manutenção',
      targetAudience: 'Residências e comércios locais',
    },
  },
  {
    id: 'autonomo',
    label: 'Profissional autônomo',
    desc: 'Apresentação direta e profissional',
    layout: 'generico',
    colors: ['#6366f1', '#0a0a0b'],
    brief: {
      segment: 'Profissional autônomo',
      description: 'Site de apresentação profissional com serviços e contato direto.',
      services: 'Consultoria, Atendimento personalizado',
      targetAudience: 'Clientes locais',
    },
  },
];

// ── Estilos visuais (seletores) ──────────────────────────────────────────────
const STYLES = [
  { label: 'Minimalista e elegante' },
  { label: 'Moderno e comercial' },
  { label: 'Luxuoso' },
  { label: 'Urbano' },
  { label: 'Natural e acolhedor' },
  { label: 'Editorial e criativo' },
];

interface BriefForm {
  companyName: string;
  segment: string;
  description: string;
  targetAudience: string;
  services: string;
  phone: string;
  whatsapp: string;
  email: string;
  address: string;
  instagram: string;
  goal: string;
  style: string;
}

const emptyForm: BriefForm = {
  companyName: '',
  segment: '',
  description: '',
  targetAudience: '',
  services: '',
  phone: '',
  whatsapp: '',
  email: '',
  address: '',
  instagram: '',
  goal: '',
  style: '',
};

type Tab = 'briefing' | 'preview';

export default function CreateSitePage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [form, setForm] = useState<BriefForm>(emptyForm);
  const [formError, setFormError] = useState('');
  const [created, setCreated] = useState<{
    id: number;
    content: SiteContent | null;
    source: 'ai' | 'local';
  } | null>(null);
  const [tab, setTab] = useState<Tab>('briefing');

  const { data: aiStatus } = useQuery<{ configured: boolean }>({
    queryKey: ['ai-status'],
    queryFn: () => api.get('/sites/ai-status'),
  });

  const createMutation = useMutation({
    mutationFn: (body: Record<string, unknown>) =>
      api.post<{ id: number; content: SiteContent | null; source: 'ai' | 'local' }>('/sites', body),
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ['sites'] });
      setCreated({ id: res.id, content: res.content, source: res.source });
      setFormError('');
      setTab('preview');
    },
    onError: (err: Error) => setFormError(err.message),
  });

  function update(field: keyof BriefForm, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  function applyModel(m: ModelDef) {
    setForm((prev) => ({ ...prev, ...m.brief }));
    setFormError('');
  }

  function generate() {
    setFormError('');
    if (form.companyName.trim().length < 2) {
      setFormError('Informe o nome da empresa.');
      setTab('briefing');
      return;
    }
    const body: Record<string, unknown> = { companyName: form.companyName.trim() };
    for (const [k, v] of Object.entries(form)) {
      if (k !== 'companyName' && v.trim()) body[k] = v.trim();
    }
    createMutation.mutate(body);
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    generate();
  }

  // download do HTML gerado (exportação local, sem depender de serviço externo)
  function exportHtml() {
    if (!created?.content) return;
    const html = buildSiteHtml(created.content);
    const blob = new Blob([html], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${form.companyName.trim() || 'site'}.html`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <main className="flex-1 p-5 sm:p-6 overflow-auto">
        {/* Cabeçalho */}
        <header className="mb-5 animate-fade-up">
          <h2 className="page-title">Criar site com IA</h2>
          <p className="page-subtitle">
            Preencha o briefing, escolha um modelo e gere seu site.
          </p>
        </header>

        {/* Indicador de etapas */}
        <ol className="flex items-center gap-2 mb-6 text-xs">
          {[
            { key: 'briefing', label: 'Briefing' },
            { key: 'modelo', label: 'Modelo' },
            { key: 'previa', label: 'Prévia' },
            { key: 'publicacao', label: 'Publicação' },
          ].map((s, i) => {
            const active =
              (s.key === 'briefing' && !created) ||
              (s.key === 'modelo' && !created) ||
              (s.key === 'previa' && !!created) ||
              (s.key === 'publicacao' && !!created);
            return (
              <li key={s.key} className="flex items-center gap-2">
                <span
                  className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full ${
                    active ? 'bg-brand-soft text-brand' : 'text-ink-faint'
                  }`}
                >
                  <span
                    className={`w-4 h-4 rounded-full grid place-items-center text-[10px] ${
                      active ? 'bg-brand text-white' : 'bg-surface-hover text-ink-faint'
                    }`}
                  >
                    {i + 1}
                  </span>
                  {s.label}
                </span>
                {i < 3 && <span className="text-ink-faint">›</span>}
              </li>
            );
          })}
        </ol>

        {aiStatus && !aiStatus.configured && (
          <div className="mb-5 bg-yellow-950/40 border border-yellow-900 text-yellow-300 text-sm rounded-lg px-4 py-3">
            <p className="font-medium mb-0.5">Modo gerador local</p>
            <p>
              Sem chave de IA no servidor, a geração usa modelos locais reais e
              editáveis. Defina <code className="bg-surface-hover px-1 rounded">AI_API_KEY</code>{' '}
              no <code className="bg-surface-hover px-1 rounded">server/.env</code> para ativar a IA.
            </p>
          </div>
        )}

        {/* Abas (mobile) */}
        <div className="xl:hidden flex gap-1 p-0.5 mb-4 bg-surface-panel border border-surface-line rounded-lg w-fit">
          {(['briefing', 'preview'] as Tab[]).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`text-xs px-3 py-1.5 rounded-md transition-colors ${
                tab === t ? 'bg-brand-soft text-brand' : 'text-ink-base'
              }`}
            >
              {t === 'briefing' ? 'Configuração' : 'Prévia'}
            </button>
          ))}
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,420px)_1fr] gap-6">
          {/* Coluna configuração */}
          <div className={`flex-col gap-4 ${tab === 'briefing' ? 'flex' : 'hidden xl:flex'}`}>
            {/* Modelos */}
            <Card>
              <h3 className="text-sm font-medium text-ink-strong mb-3">Escolha um modelo</h3>
              <div className="grid grid-cols-2 gap-3">
                {MODELS.map((m) => (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => applyModel(m)}
                    className="text-left rounded-xl border border-surface-line overflow-hidden hover:border-brand transition-colors group"
                  >
                    <div className="h-16 relative" style={{ background: m.colors[1] }}>
                      <span
                        className="absolute left-1/2 -translate-x-1/2 bottom-2.5 px-2 py-0.5 rounded text-[10px] font-semibold text-white"
                        style={{ background: m.colors[0] }}
                      >
                        {m.label}
                      </span>
                    </div>
                    <div className="p-2.5">
                      <p className="text-xs font-medium text-ink-strong">{m.label}</p>
                      <p className="text-[11px] text-ink-faint mt-0.5">{m.desc}</p>
                    </div>
                  </button>
                ))}
              </div>
            </Card>

            {/* Briefing */}
            <Card>
              <form onSubmit={handleSubmit} className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="sm:col-span-2">
                  <label className="field-label">Nome da empresa *</label>
                  <input
                    className="field"
                    value={form.companyName}
                    onChange={(e) => update('companyName', e.target.value)}
                    required
                    minLength={2}
                    placeholder="Ex: Barbearia do Zé"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="field-label">Segmento</label>
                  <input
                    className="field"
                    value={form.segment}
                    onChange={(e) => update('segment', e.target.value)}
                    placeholder="Ex: Barbearia"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="field-label">Público-alvo</label>
                  <input
                    className="field"
                    value={form.targetAudience}
                    onChange={(e) => update('targetAudience', e.target.value)}
                    placeholder="Ex: Homens, 18 a 45 anos"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="field-label">Descrição do negócio</label>
                  <textarea
                    className="field"
                    rows={3}
                    value={form.description}
                    onChange={(e) => update('description', e.target.value)}
                    placeholder="Descreva o negócio e diferenciais..."
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="field-label">Serviços ou produtos</label>
                  <input
                    className="field"
                    value={form.services}
                    onChange={(e) => update('services', e.target.value)}
                    placeholder="Separe por vírgula"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="field-label">Estilo visual</label>
                  <div className="flex flex-wrap gap-2">
                    {STYLES.map((s) => (
                      <button
                        key={s.label}
                        type="button"
                        onClick={() => update('style', form.style === s.label ? '' : s.label)}
                        className={`text-xs px-3 py-1.5 rounded-lg border transition-colors ${
                          form.style === s.label
                            ? 'bg-brand-soft text-brand border-brand'
                            : 'bg-surface-hover text-ink-base border-surface-line hover:text-ink-strong'
                        }`}
                      >
                        {s.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="field-label">Telefone</label>
                  <input className="field" value={form.phone} onChange={(e) => update('phone', e.target.value)} placeholder="(67) 99999-8888" />
                </div>
                <div>
                  <label className="field-label">WhatsApp</label>
                  <input className="field" value={form.whatsapp} onChange={(e) => update('whatsapp', e.target.value)} placeholder="(67) 99999-8888" />
                </div>
                <div>
                  <label className="field-label">E-mail</label>
                  <input className="field" type="email" value={form.email} onChange={(e) => update('email', e.target.value)} placeholder="contato@empresa.com" />
                </div>
                <div>
                  <label className="field-label">Instagram</label>
                  <input className="field" value={form.instagram} onChange={(e) => update('instagram', e.target.value)} placeholder="@empresa" />
                </div>
                <div className="sm:col-span-2">
                  <label className="field-label">Endereço</label>
                  <input className="field" value={form.address} onChange={(e) => update('address', e.target.value)} placeholder="Rua, número, cidade" />
                </div>
                <div className="sm:col-span-2">
                  <label className="field-label">Objetivo do site</label>
                  <input className="field" value={form.goal} onChange={(e) => update('goal', e.target.value)} placeholder="Ex: Receber agendamentos" />
                </div>

                {formError && (
                  <div className="sm:col-span-2">
                    <ErrorMessage message={formError} />
                  </div>
                )}

                <div className="sm:col-span-2">
                  <button type="submit" className="btn-primary w-full" disabled={createMutation.isPending}>
                    {createMutation.isPending ? 'Gerando...' : 'Gerar site'}
                  </button>
                </div>
              </form>
            </Card>
          </div>

          {/* Coluna prévia (grande) */}
          <div className={`${tab === 'preview' ? 'block' : 'hidden xl:block'}`}>
            <div className="sticky top-6">
              {created && (
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <Badge color={created.source === 'ai' ? 'green' : 'yellow'}>
                      {created.source === 'ai' ? 'Gerado com IA' : 'Gerado localmente'}
                    </Badge>
                  </div>
                </div>
              )}

              <SitePreview
                content={created?.content ?? null}
                loading={createMutation.isPending}
                error={formError && !created ? formError : undefined}
              />

              {/* Barra de ações */}
              <div className="flex flex-wrap gap-2 mt-4">
                <button className="btn-primary" onClick={generate} disabled={createMutation.isPending}>
                  Gerar site
                </button>
                {created && (
                  <>
                    <button className="btn-secondary" onClick={() => navigate(`/editor/${created.id}`)}>
                      Editar
                    </button>
                    <button className="btn-secondary" onClick={() => navigate('/my-sites')}>
                      Salvar em Meus sites
                    </button>
                    <button className="btn-secondary" onClick={exportHtml}>
                      Exportar HTML
                    </button>
                    {created.content && (
                      <a
                        className="btn-secondary"
                        href={`data:text/html;charset=utf-8,${encodeURIComponent(buildSiteHtml(created.content))}`}
                        target="_blank"
                        rel="noreferrer"
                      >
                        Abrir prévia
                      </a>
                    )}
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
