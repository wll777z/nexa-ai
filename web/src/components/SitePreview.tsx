/**
 * Pré-visualização em iframe sandbox (isolada — não injetamos HTML no DOM
 * da aplicação). Desktop/mobile, estado vazio com amostras de demonstração.
 */
import { useMemo, useState } from 'react';
import type { SiteContent } from '../types/site';
import { buildSiteHtml } from './siteHtml';

type Device = 'desktop' | 'mobile';

export function SitePreview({
  content,
  loading,
  error,
}: {
  content: SiteContent | null;
  loading?: boolean;
  error?: string;
}) {
  const [device, setDevice] = useState<Device>('desktop');
  const html = useMemo(() => (content ? buildSiteHtml(content) : ''), [content]);

  if (loading) {
    return (
      <div className="rounded-2xl border border-surface-line bg-surface-panel h-[560px] flex flex-col items-center justify-center gap-3">
        <div className="w-8 h-8 rounded-full border-2 border-brand border-t-transparent animate-spin" />
        <p className="text-sm text-ink-base">Gerando seu site, aguarde...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-2xl border border-red-900 bg-red-950/40 h-[560px] flex flex-col items-center justify-center gap-2 p-8 text-center">
        <p className="text-sm font-medium text-red-400">Não foi possível gerar o site</p>
        <p className="text-xs text-red-400/80 max-w-sm">{error}</p>
      </div>
    );
  }

  if (!content) {
    return <EmptyState />;
  }

  const width = device === 'desktop' ? '100%' : '390px';

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <span className="text-xs text-ink-faint">
          Prévia {device === 'desktop' ? 'desktop' : 'mobile'}
        </span>
        <div className="flex gap-1 p-0.5 bg-surface-panel border border-surface-line rounded-lg">
          {(['desktop', 'mobile'] as Device[]).map((d) => (
            <button
              key={d}
              onClick={() => setDevice(d)}
              className={`text-xs px-3 py-1 rounded-md transition-colors ${
                device === d ? 'bg-brand-soft text-brand' : 'text-ink-base hover:text-ink-strong'
              }`}
            >
              {d === 'desktop' ? 'Desktop' : 'Mobile'}
            </button>
          ))}
        </div>
      </div>

      <div
        className="mx-auto rounded-2xl border border-surface-line overflow-hidden transition-all duration-300"
        style={{ width, maxWidth: '100%' }}
      >
        <iframe
          srcDoc={html}
          sandbox="allow-same-origin allow-popups"
          title="Prévia do site"
          className="w-full h-[560px] bg-white block"
        />
      </div>
    </div>
  );
}

/** Tela inicial com amostras identificadas claramente como demonstração. */
function EmptyState() {
  const samples: { layout: string; label: string; desc: string; colors: [string, string] }[] = [
    { layout: 'barbearia', label: 'Barbearia', desc: 'Clássico, destaque âmbar', colors: ['#b45309', '#0c0a09'] },
    { layout: 'salao', label: 'Salão / Estética', desc: 'Elegante, tons suaves', colors: ['#be185d', '#1c1917'] },
    { layout: 'restaurante', label: 'Restaurante', desc: 'Acolhedor, cores quentes', colors: ['#dc2626', '#1c1917'] },
    { layout: 'clinica', label: 'Clínica', desc: 'Limpo, transmite confiança', colors: ['#0ea5e9', '#f8fafc'] },
  ];

  return (
    <div className="rounded-2xl border border-surface-line bg-surface-panel min-h-[560px] flex flex-col p-8">
      <p className="text-sm text-ink-base text-center">
        Seu site aparece aqui depois de gerado.
      </p>

      <div className="mt-6 inline-flex self-center items-center gap-1.5 text-xs text-ink-faint bg-surface-hover px-3 py-1 rounded-full">
        <span className="w-1.5 h-1.5 rounded-full bg-yellow-400" />
        Amostras de demonstração — não são projetos seus
      </div>

      <div className="grid grid-cols-2 gap-4 mt-6 flex-1">
        {samples.map((s) => (
          <div
            key={s.layout}
            className="rounded-xl overflow-hidden border border-surface-line flex flex-col"
          >
            <div className="h-28 relative" style={{ background: s.colors[1] }}>
              <div
                className="absolute left-1/2 -translate-x-1/2 bottom-4 px-3 py-1.5 rounded-md text-[11px] font-semibold text-white"
                style={{ background: s.colors[0] }}
              >
                {s.label}
              </div>
            </div>
            <div className="p-3 bg-surface-card flex-1">
              <p className="text-xs font-medium text-ink-strong">{s.label}</p>
              <p className="text-[11px] text-ink-faint mt-0.5">{s.desc}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
