import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../services/api';
import { Sidebar } from '../components/Sidebar';
import { Card, Spinner, ErrorMessage, Badge } from '../components/UI';
import { SitePreview } from '../components/SitePreview';
import { layoutLabel } from '../components/siteHtml';
import type { SiteContent, SiteBrief, SiteLayout, FaqItem } from '../types/site';

const LAYOUT_OPTIONS: { value: SiteContent['layout']; label: string }[] = [
  { value: 'generico', label: 'Padrão' },
  { value: 'barbearia', label: 'Clássico' },
  { value: 'salao', label: 'Elegante' },
  { value: 'restaurante', label: 'Acolhedor' },
  { value: 'loja', label: 'Moderno' },
  { value: 'clinica', label: 'Confiança' },
  { value: 'servico', label: 'Direto' },
];

export default function EditorPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [name, setName] = useState('');
  const [content, setContent] = useState<SiteContent | null>(null);
  const [brief, setBrief] = useState<SiteBrief | null>(null);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');

  const { data, isLoading } = useQuery<{
    name: string;
    content: SiteContent | null;
    brief: SiteBrief | null;
  }>({
    queryKey: ['site', id],
    queryFn: () => api.get(`/sites/${id}`),
    enabled: !!id,
  });

  // sincroniza estado local na primeira carga
  if (data && content === null && data.content) {
    setName(data.name);
    setContent(data.content);
    setBrief(data.brief);
  }

  const saveMutation = useMutation({
    mutationFn: () =>
      api.put(`/sites/${id}`, { name: name.trim(), content, brief, status: 'ready' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sites'] });
      queryClient.invalidateQueries({ queryKey: ['site', id] });
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    },
    onError: (err: Error) => setError(err.message),
  });

  function updateHero(field: keyof SiteContent['hero'], value: string) {
    setContent((p) => (p ? { ...p, hero: { ...p.hero, [field]: value } } : p));
  }
  function updateAbout(field: keyof SiteContent['about'], value: string) {
    setContent((p) => (p ? { ...p, about: { ...p.about, [field]: value } } : p));
  }
  function updateContact(field: keyof SiteContent['contact'], value: string) {
    setContent((p) => (p ? { ...p, contact: { ...p.contact, [field]: value } } : p));
  }
  function updateColor(field: 'primary' | 'background', value: string) {
    setContent((p) => (p ? { ...p, colors: { ...p.colors, [field]: value } } : p));
  }
  function updateListItem(
    section: 'services' | 'differentials',
    index: number,
    value: string,
  ) {
    setContent((p) => {
      if (!p) return p;
      const items = [...p[section].items];
      items[index] = value;
      return { ...p, [section]: { ...p[section], items } };
    });
  }
  function addListItem(section: 'services' | 'differentials') {
    setContent((p) => (p ? { ...p, [section]: { ...p[section], items: [...p[section].items, ''] } } : p));
  }
  function removeListItem(section: 'services' | 'differentials', index: number) {
    setContent((p) => {
      if (!p) return p;
      const items = p[section].items.filter((_, i) => i !== index);
      return { ...p, [section]: { ...p[section], items } };
    });
  }

  function updateLayout(layout: SiteContent['layout']) {
    setContent((p) => (p ? { ...p, layout } : p));
  }

  function updateFaqItem(index: number, field: 'q' | 'a', value: string) {
    setContent((p) => {
      if (!p) return p;
      const items = p.faq.items.map((it, i) => (i === index ? { ...it, [field]: value } : it));
      return { ...p, faq: { ...p.faq, items } };
    });
  }
  function addFaqItem() {
    setContent((p) => (p ? { ...p, faq: { ...p.faq, items: [...p.faq.items, { q: '', a: '' }] } } : p));
  }
  function removeFaqItem(index: number) {
    setContent((p) => {
      if (!p) return p;
      return { ...p, faq: { ...p.faq, items: p.faq.items.filter((_, i) => i !== index) } };
    });
  }

  // ── Galeria (URLs de imagem) ──
  function updateGalleryItem(index: number, value: string) {
    setContent((p) => {
      if (!p) return p;
      const images = p.gallery.images.map((s, i) => (i === index ? value : s));
      return { ...p, gallery: { ...p.gallery, images } };
    });
  }
  function addGalleryItem() {
    setContent((p) => (p ? { ...p, gallery: { ...p.gallery, images: [...p.gallery.images, ''] } } : p));
  }
  function removeGalleryItem(index: number) {
    setContent((p) => {
      if (!p) return p;
      return { ...p, gallery: { ...p.gallery, images: p.gallery.images.filter((_, i) => i !== index) } };
    });
  }

  if (isLoading || !content) {
    return (
      <div className="flex min-h-screen">
        <Sidebar />
        <main className="flex-1 p-6">
          <Spinner label="Carregando editor..." />
        </main>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <main className="flex-1 p-6 overflow-auto">
        <header className="flex flex-wrap items-center justify-between gap-3 mb-6 animate-fade-up">
          <div>
            <h2 className="page-title">Editor visual</h2>
            <p className="page-subtitle">
              Edite o conteúdo. As mudanças aparecem na prévia na hora.
            </p>
          </div>
          <div className="flex items-center gap-2">
            {saved && <Badge color="green">Salvo</Badge>}
            <button className="btn-primary" onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending}>
              {saveMutation.isPending ? 'Salvando...' : 'Salvar'}
            </button>
            <button className="btn-secondary" onClick={() => navigate('/my-sites')}>
              Voltar
            </button>
          </div>
        </header>

        {error && <div className="mb-4"><ErrorMessage message={error} /></div>}

        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
          {/* Painel de edição */}
          <div className="flex flex-col gap-4">
            <Card>
              <label className="field-label">Nome do projeto</label>
              <input className="field" value={name} onChange={(e) => setName(e.target.value)} />
              {brief?.companyName && (
                <p className="text-xs text-ink-faint mt-2">Empresa: {brief.companyName}</p>
              )}
            </Card>

            <Card>
              <h3 className="text-sm font-medium text-ink-strong mb-3">Layout</h3>
              <div className="flex flex-wrap gap-2">
                {LAYOUT_OPTIONS.map((l) => (
                  <button
                    key={l.value}
                    type="button"
                    onClick={() => updateLayout(l.value)}
                    className={`text-xs px-3 py-1.5 rounded-lg border transition-colors ${
                      content.layout === l.value
                        ? 'bg-brand-soft text-brand border-brand'
                        : 'bg-surface-hover text-ink-base border-surface-line hover:text-ink-strong'
                    }`}
                  >
                    {l.label}
                  </button>
                ))}
              </div>
            </Card>

            <Card>
              <h3 className="text-sm font-medium text-ink-strong mb-3">Hero</h3>
              <div className="flex flex-col gap-3">
                <div>
                  <label className="field-label">Título</label>
                  <input className="field" value={content.hero.title} onChange={(e) => updateHero('title', e.target.value)} />
                </div>
                <div>
                  <label className="field-label">Subtítulo</label>
                  <input className="field" value={content.hero.subtitle} onChange={(e) => updateHero('subtitle', e.target.value)} />
                </div>
                <div>
                  <label className="field-label">Texto do botão</label>
                  <input className="field" value={content.hero.cta} onChange={(e) => updateHero('cta', e.target.value)} />
                </div>
                <div>
                  <label className="field-label">Link do botão</label>
                  <input className="field" value={content.hero.ctaLink} onChange={(e) => updateHero('ctaLink', e.target.value)} placeholder="https://wa.me/..." />
                </div>
              </div>
            </Card>

            <Card>
              <h3 className="text-sm font-medium text-ink-strong mb-3">Sobre</h3>
              <div>
                <label className="field-label">Texto</label>
                <textarea className="field" rows={3} value={content.about.text} onChange={(e) => updateAbout('text', e.target.value)} />
              </div>
            </Card>

            <ListEditor
              title="Serviços"
              items={content.services.items}
              onEdit={(i, v) => updateListItem('services', i, v)}
              onAdd={() => addListItem('services')}
              onRemove={(i) => removeListItem('services', i)}
            />

            <ListEditor
              title="Diferenciais"
              items={content.differentials.items}
              onEdit={(i, v) => updateListItem('differentials', i, v)}
              onAdd={() => addListItem('differentials')}
              onRemove={(i) => removeListItem('differentials', i)}
            />

            <Card>
              <h3 className="text-sm font-medium text-ink-strong mb-3">Perguntas frequentes</h3>
              <div className="flex flex-col gap-3">
                {content.faq.items.map((item, i) => (
                  <div key={i} className="flex flex-col gap-2 p-3 rounded-lg border border-surface-line">
                    <div className="flex items-start gap-2">
                      <input
                        className="field"
                        value={item.q}
                        onChange={(e) => updateFaqItem(i, 'q', e.target.value)}
                        placeholder={`Pergunta ${i + 1}`}
                      />
                      <button
                        type="button"
                        onClick={() => removeFaqItem(i)}
                        className="text-xs text-red-400 hover:text-red-300 px-2 shrink-0"
                      >
                        Remover
                      </button>
                    </div>
                    <textarea
                      className="field"
                      rows={2}
                      value={item.a}
                      onChange={(e) => updateFaqItem(i, 'a', e.target.value)}
                      placeholder="Resposta"
                    />
                  </div>
                ))}
                <button type="button" onClick={addFaqItem} className="btn-secondary text-xs self-start">
                  Adicionar pergunta
                </button>
              </div>
            </Card>

            <Card>
              <h3 className="text-sm font-medium text-ink-strong mb-3">Galeria de fotos</h3>
              <p className="text-xs text-ink-faint mb-3">
                Cole o link de cada foto (ex: uma imagem hospedada no seu Google Drive, Imgur ou site). Upload direto de arquivo ainda não está disponível.
              </p>
              <div className="flex flex-col gap-2">
                {content.gallery.images.map((src, i) => (
                  <div key={i} className="flex gap-2 items-center">
                    {src && (
                      <img
                        src={src}
                        alt=""
                        className="w-10 h-10 rounded object-cover border border-surface-line shrink-0"
                        onError={(e) => (e.currentTarget.style.visibility = 'hidden')}
                      />
                    )}
                    <input
                      className="field"
                      value={src}
                      onChange={(e) => updateGalleryItem(i, e.target.value)}
                      placeholder={`URL da foto ${i + 1}`}
                    />
                    <button
                      type="button"
                      onClick={() => removeGalleryItem(i)}
                      className="text-xs text-red-400 hover:text-red-300 px-2 shrink-0"
                    >
                      Remover
                    </button>
                  </div>
                ))}
                <button type="button" onClick={addGalleryItem} className="btn-secondary text-xs self-start">
                  Adicionar foto
                </button>
              </div>
            </Card>

            <Card>
              <h3 className="text-sm font-medium text-ink-strong mb-3">Layout</h3>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {LAYOUT_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => updateLayout(opt.value)}
                    className={`text-xs px-3 py-2 rounded-lg border transition-colors ${
                      content.layout === opt.value
                        ? 'border-brand bg-brand-soft text-brand'
                        : 'border-surface-line text-ink-base hover:border-ink-faint'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
              <p className="text-xs text-ink-faint mt-3">
                O layout muda a paleta padrão sugerida; as cores continuam editáveis abaixo.
              </p>
            </Card>

            <Card>
              <h3 className="text-sm font-medium text-ink-strong mb-3">Contato</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="field-label">WhatsApp</label>
                  <input className="field" value={content.contact.whatsapp} onChange={(e) => updateContact('whatsapp', e.target.value)} />
                </div>
                <div>
                  <label className="field-label">Telefone</label>
                  <input className="field" value={content.contact.phone} onChange={(e) => updateContact('phone', e.target.value)} />
                </div>
                <div>
                  <label className="field-label">E-mail</label>
                  <input className="field" value={content.contact.email} onChange={(e) => updateContact('email', e.target.value)} />
                </div>
                <div>
                  <label className="field-label">Instagram</label>
                  <input className="field" value={content.contact.instagram} onChange={(e) => updateContact('instagram', e.target.value)} />
                </div>
                <div className="sm:col-span-2">
                  <label className="field-label">Endereço</label>
                  <input className="field" value={content.contact.address} onChange={(e) => updateContact('address', e.target.value)} />
                </div>
              </div>
            </Card>

            <Card>
              <h3 className="text-sm font-medium text-ink-strong mb-3">Cores</h3>
              <div className="flex gap-4">
                <div>
                  <label className="field-label">Cor primária</label>
                  <input type="color" className="field h-10" value={content.colors.primary} onChange={(e) => updateColor('primary', e.target.value)} />
                </div>
                <div>
                  <label className="field-label">Fundo</label>
                  <input type="color" className="field h-10" value={content.colors.background} onChange={(e) => updateColor('background', e.target.value)} />
                </div>
              </div>
            </Card>
          </div>

          {/* Prévia com seletor de dispositivo */}
          <div>
            <Card>
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-medium text-ink-strong">Pré-visualização</h3>
                {content && (
                  <span className="text-xs text-ink-faint">Layout: {layoutLabel(content.layout)}</span>
                )}
              </div>
              <SitePreview content={content} />
            </Card>
          </div>
        </div>
      </main>
    </div>
  );
}

function ListEditor({
  title,
  items,
  onEdit,
  onAdd,
  onRemove,
}: {
  title: string;
  items: string[];
  onEdit: (i: number, v: string) => void;
  onAdd: () => void;
  onRemove: (i: number) => void;
}) {
  return (
    <Card>
      <h3 className="text-sm font-medium text-ink-strong mb-3">{title}</h3>
      <div className="flex flex-col gap-2">
        {items.map((item, i) => (
          <div key={i} className="flex gap-2">
            <input
              className="field"
              value={item}
              onChange={(e) => onEdit(i, e.target.value)}
              placeholder={`${title} ${i + 1}`}
            />
            <button
              type="button"
              onClick={() => onRemove(i)}
              className="text-xs text-red-400 hover:text-red-300 px-2 shrink-0"
            >
              Remover
            </button>
          </div>
        ))}
        <button type="button" onClick={onAdd} className="btn-secondary text-xs self-start">
          Adicionar item
        </button>
      </div>
    </Card>
  );
}
