import { useCallback, useEffect, useRef, useState } from 'react';
import type { KeyboardEvent } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { api } from '../services/api';
import { streamSiteHtml } from '../services/aiStream';
import { Sidebar } from '../components/Sidebar';
import { ErrorMessage } from '../components/UI';

type Device = 'desktop' | 'tablet' | 'mobile';

const DEVICE_WIDTH: Record<Device, string> = {
  desktop: '100%',
  tablet: '768px',
  mobile: '390px',
};

const DEVICE_LABEL: Record<Device, string> = {
  desktop: 'Desktop',
  tablet: 'Tablet',
  mobile: 'Celular',
};

const SUGGESTIONS = [
  'Site para uma barbearia moderna, com serviços e botão de agendar pelo WhatsApp',
  'Página para uma clínica de estética, visual elegante em tons suaves',
  'Site de um restaurante com cardápio por categorias e área de reservas',
  'Landing page para uma loja de roupas femininas, estilo minimalista',
];

interface ChatMessage {
  role: 'user' | 'assistant';
  text: string;
}

interface HtmlState {
  html: string | null;
  canUndo: boolean;
  aiConfigured: boolean;
}

/** Pega o HTML parcial enquanto o stream chega (só renderiza quando já há <body>). */
function partialHtml(raw: string): string {
  const start = raw.search(/<!doctype html|<html[\s>]/i);
  if (start === -1) return '';
  const text = raw.slice(start);
  return /<body[\s>]/i.test(text) ? text : '';
}

export default function AiBuilderPage() {
  const { id } = useParams<{ id: string }>();
  return id ? <BuilderView key={id} id={id} /> : <StartView />;
}

function StartView() {
  const navigate = useNavigate();
  const [name, setName] = useState('');
  const [prompt, setPrompt] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function start() {
    if (name.trim().length < 2) {
      setError('Dê um nome ao projeto.');
      return;
    }
    if (prompt.trim().length < 3) {
      setError('Descreva o site que você quer criar.');
      return;
    }
    setBusy(true);
    setError('');
    try {
      const created = await api.post<{ id: number }>('/sites', {
        companyName: name.trim(),
        description: prompt.trim(),
      });
      navigate(`/ai-builder/${created.id}`, { state: { initialPrompt: prompt.trim() } });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao criar o projeto.');
      setBusy(false);
    }
  }

  return (
    <div className='flex min-h-screen'>
      <Sidebar />
      <main className='flex-1 p-6 overflow-auto'>
        <div className='max-w-2xl mx-auto mt-10'>
          <h2 className='text-2xl font-semibold text-ink-strong'>Crie um site conversando com a IA</h2>
          <p className='text-ink-base text-sm mt-1'>
            Descreva o negócio e o visual que você quer. A IA monta o site completo e você ajusta tudo por chat.
          </p>

          <div className='card mt-6 flex flex-col gap-4'>
            <div>
              <label className='field-label'>Nome do projeto</label>
              <input
                className='field'
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder='Ex.: Barbearia do Zé'
              />
            </div>
            <div>
              <label className='field-label'>O que você quer criar?</label>
              <textarea
                className='field'
                rows={5}
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder='Descreva o negócio, os serviços, o estilo e o contato (WhatsApp, Instagram...)'
              />
            </div>
            <div className='flex flex-wrap gap-2'>
              {SUGGESTIONS.map((s) => (
                <button
                  key={s}
                  type='button'
                  onClick={() => setPrompt(s)}
                  className='text-xs px-3 py-1.5 rounded-lg border border-surface-line bg-surface-hover text-ink-base hover:text-ink-strong text-left'
                >
                  {s}
                </button>
              ))}
            </div>
            {error && <ErrorMessage message={error} />}
            <button className='btn-primary self-start' onClick={start} disabled={busy}>
              {busy ? 'Criando...' : 'Gerar site'}
            </button>
          </div>
        </div>
      </main>
    </div>
  );
}

function BuilderView({ id }: { id: string }) {
  const location = useLocation();
  const navigate = useNavigate();
  const initialPrompt = (location.state as { initialPrompt?: string } | null)?.initialPrompt;

  const [html, setHtml] = useState('');
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [streaming, setStreaming] = useState(false);
  const [error, setError] = useState('');
  const [device, setDevice] = useState<Device>('desktop');
  const [canUndo, setCanUndo] = useState(false);
  const [configured, setConfigured] = useState(true);
  const [loaded, setLoaded] = useState(false);

  const abortRef = useRef<AbortController | null>(null);
  const startedRef = useRef(false);
  const chatEndRef = useRef<HTMLDivElement | null>(null);

  const loadSaved = useCallback(async () => {
    const state = await api.get<HtmlState>(`/sites/${id}/html`);
    setHtml(state.html ?? '');
    setCanUndo(state.canUndo);
    setConfigured(state.aiConfigured);
  }, [id]);

  const send = useCallback(
    async (text: string) => {
      const prompt = text.trim();
      if (!prompt) return;
      setError('');
      setStreaming(true);
      setMessages((m) => [...m, { role: 'user', text: prompt }]);

      const controller = new AbortController();
      abortRef.current = controller;
      let raw = '';
      let lastRender = 0;
      let ok = false;

      try {
        await streamSiteHtml(
          id,
          prompt,
          (e) => {
            if (e.type === 'delta') {
              raw += e.text;
              const now = Date.now();
              if (now - lastRender > 600) {
                lastRender = now;
                const partial = partialHtml(raw);
                if (partial) setHtml(partial);
              }
            } else if (e.type === 'done') {
              ok = true;
              setHtml(e.html);
              setCanUndo(true);
              setMessages((m) => [
                ...m,
                { role: 'assistant', text: 'Pronto! Atualizei o site. Peça outro ajuste quando quiser.' },
              ]);
            } else if (e.type === 'error') {
              setError(e.message);
            }
          },
          controller.signal,
        );
      } catch (err) {
        if (controller.signal.aborted) {
          setMessages((m) => [...m, { role: 'assistant', text: 'Geração interrompida.' }]);
        } else {
          setError(err instanceof Error ? err.message : 'Falha ao gerar o site.');
        }
      } finally {
        setStreaming(false);
        abortRef.current = null;
        if (!ok) {
          // descarta o HTML parcial e volta para a última versão salva
          loadSaved().catch(() => undefined);
        }
      }
    },
    [id, loadSaved],
  );

  useEffect(() => {
    let cancelled = false;
    loadSaved()
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Erro ao carregar o projeto.');
      })
      .finally(() => {
        if (!cancelled) setLoaded(true);
      });
    return () => {
      cancelled = true;
    };
  }, [loadSaved]);

  // primeira geração automática, vinda da tela inicial
  useEffect(() => {
    if (!loaded || startedRef.current) return;
    startedRef.current = true;
    if (!html && initialPrompt && configured) void send(initialPrompt);
  }, [loaded, html, initialPrompt, configured, send]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, streaming]);

  function submit() {
    if (streaming || !configured || !input.trim()) return;
    const text = input;
    setInput('');
    void send(text);
  }

  function onKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      submit();
    }
  }

  async function undo() {
    try {
      const state = await api.post<HtmlState>(`/sites/${id}/html/undo`);
      setHtml(state.html ?? '');
      setCanUndo(state.canUndo);
      setMessages((m) => [...m, { role: 'assistant', text: 'Voltei para a versão anterior.' }]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Não foi possível desfazer.');
    }
  }

  function download() {
    const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `site-${id}.html`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className='flex min-h-screen'>
      <Sidebar />
      <main className='flex-1 grid grid-cols-1 lg:grid-cols-[380px_1fr] lg:h-screen'>
        {/* Chat */}
        <section className='flex flex-col border-r border-surface-line min-h-0'>
          <header className='flex items-center justify-between px-4 py-3 border-b border-surface-line'>
            <h2 className='text-sm font-semibold text-ink-strong'>Construtor por chat</h2>
            <button className='text-xs text-ink-base hover:text-ink-strong' onClick={() => navigate('/my-sites')}>
              Meus sites
            </button>
          </header>

          <div className='flex-1 overflow-auto p-4 flex flex-col gap-3 min-h-[240px]'>
            {!configured && (
              <ErrorMessage message='A IA ainda não está conectada. Defina ANTHROPIC_API_KEY em server/.env e reinicie o servidor.' />
            )}
            {messages.length === 0 && !streaming && configured && (
              <p className='text-xs text-ink-faint'>
                Descreva o que quer mudar. Exemplos: deixe o botão verde, troque o título, adicione uma seção de planos.
              </p>
            )}
            {messages.map((m, i) => (
              <div
                key={i}
                className={`text-sm rounded-xl px-3 py-2 max-w-[90%] ${
                  m.role === 'user'
                    ? 'self-end bg-brand-soft text-ink-strong'
                    : 'self-start bg-surface-hover text-ink-base'
                }`}
              >
                {m.text}
              </div>
            ))}
            {streaming && (
              <div className='self-start text-sm rounded-xl px-3 py-2 bg-surface-hover text-ink-base'>
                Gerando o site...
              </div>
            )}
            {error && <ErrorMessage message={error} />}
            <div ref={chatEndRef} />
          </div>

          <div className='p-3 border-t border-surface-line flex flex-col gap-2'>
            <textarea
              className='field'
              rows={3}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={onKeyDown}
              disabled={streaming || !configured}
              placeholder='Peça uma mudança... (Enter envia, Shift+Enter quebra linha)'
            />
            <div className='flex items-center gap-2'>
              {streaming ? (
                <button className='btn-secondary text-xs' onClick={() => abortRef.current?.abort()}>
                  Parar
                </button>
              ) : (
                <button className='btn-primary text-xs' onClick={submit} disabled={!configured || !input.trim()}>
                  Enviar
                </button>
              )}
              <button className='btn-secondary text-xs' onClick={undo} disabled={!canUndo || streaming}>
                Desfazer
              </button>
            </div>
          </div>
        </section>

        {/* Pré-visualização */}
        <section className='flex flex-col min-h-0 min-w-0'>
          <header className='flex items-center justify-between px-4 py-3 border-b border-surface-line'>
            <div className='flex gap-1 p-0.5 bg-surface-panel border border-surface-line rounded-lg'>
              {(Object.keys(DEVICE_WIDTH) as Device[]).map((d) => (
                <button
                  key={d}
                  onClick={() => setDevice(d)}
                  className={`text-xs px-3 py-1 rounded-md transition-colors ${
                    device === d ? 'bg-brand-soft text-brand' : 'text-ink-base hover:text-ink-strong'
                  }`}
                >
                  {DEVICE_LABEL[d]}
                </button>
              ))}
            </div>
            <button className='btn-secondary text-xs' onClick={download} disabled={!html || streaming}>
              Baixar HTML
            </button>
          </header>

          <div className='flex-1 min-h-[480px] p-4 overflow-auto bg-surface-app'>
            {html ? (
              <div
                className='mx-auto h-full min-h-[480px] rounded-xl border border-surface-line overflow-hidden transition-all duration-300 bg-white'
                style={{ width: DEVICE_WIDTH[device], maxWidth: '100%' }}
              >
                <iframe
                  srcDoc={html}
                  sandbox='allow-scripts allow-popups'
                  title='Prévia do site'
                  className='w-full h-full min-h-[480px] block bg-white'
                />
              </div>
            ) : (
              <div className='h-full flex items-center justify-center text-sm text-ink-faint'>
                {streaming ? 'Montando o site...' : 'Seu site aparece aqui depois de gerado.'}
              </div>
            )}
          </div>
        </section>
      </main>
    </div>
  );
}
