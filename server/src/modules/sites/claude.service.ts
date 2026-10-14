/**
 * Geração de sites completos (HTML único) com Claude, em streaming.
 * A chave vive SOMENTE no servidor (ANTHROPIC_API_KEY) e nunca vai ao frontend.
 */

const ANTHROPIC_URL = 'https://api.anthropic.com/v1/messages';
const DEFAULT_MODEL = 'claude-sonnet-4-5';

export function isClaudeConfigured(): boolean {
  return (process.env.ANTHROPIC_API_KEY ?? '').length > 0;
}

export const HTML_SYSTEM_PROMPT = `Você é um designer e desenvolvedor front-end sênior que cria sites de uma página para pequenos negócios brasileiros, com qualidade de agência.

FORMATO DA RESPOSTA
- Responda APENAS com um documento HTML completo, começando em <!doctype html> e terminando em </html>.
- Sem markdown, sem cercas de código, sem explicações antes ou depois.

TECNOLOGIA
- Arquivo único e autocontido. Use Tailwind CSS via CDN: <script src="https://cdn.tailwindcss.com"></script>
- Fontes: Google Fonts via <link> (por exemplo Inter, Poppins ou Playfair Display), conforme o segmento.
- Ícones: SVG inline. Nenhuma outra biblioteca externa.
- JavaScript apenas vanilla e mínimo (menu mobile, rolagem suave, perguntas frequentes).

DESIGN
- Mobile-first e responsivo, hierarquia visual forte, espaçamento generoso, paleta coerente com o segmento e contraste legível.
- Estrutura típica: barra de navegação fixa, hero impactante com título e botão de ação, serviços ou produtos, diferenciais, sobre, perguntas frequentes (somente se houver conteúdo útil), contato e rodapé. Adapte as seções ao negócio.
- Textos em português do Brasil, específicos do negócio, sem lorem ipsum.
- Use gradientes, formas geométricas e SVG para dar vida ao visual.

REGRAS DE HONESTIDADE
- NÃO invente depoimentos, avaliações, nomes de clientes, números, estatísticas, telefones, e-mails, endereços ou redes sociais. Se o dado não foi informado, omita a seção ou o item.
- NÃO use URLs de imagens inventadas. Só use <img> se o usuário forneceu a URL.
- Botão de WhatsApp somente se houver número informado, no formato https://wa.me/NUMERO (apenas dígitos, com DDI 55).
- Não crie formulários que enviem dados para lugar nenhum.

EDIÇÃO
- Quando receber o HTML atual e uma instrução, devolva o documento COMPLETO atualizado, alterando somente o que foi pedido e preservando o restante.`;

/**
 * Extrai o documento HTML da resposta do modelo.
 * Devolve null se não houver HTML ou se a resposta foi cortada (sem </html>).
 */
export function extractHtml(raw: string): string | null {
  let text = raw.trim();
  const fence = text.match(/```(?:html)?\s*([\s\S]*?)```/i);
  if (fence) text = fence[1].trim();
  const start = text.search(/<!doctype html|<html[\s>]/i);
  if (start === -1) return null;
  text = text.slice(start);
  const end = text.toLowerCase().lastIndexOf('</html>');
  if (end === -1) return null;
  return text.slice(0, end + '</html>'.length);
}

interface StreamEvent {
  type: string;
  delta?: { type?: string; text?: string };
  error?: { message?: string };
}

export interface ClaudeMessage {
  role: 'user' | 'assistant';
  content: string;
}

/** Chama a API de mensagens do Claude em streaming e devolve o texto completo. */
export async function streamClaude(opts: {
  system: string;
  messages: ClaudeMessage[];
  signal?: AbortSignal;
  onText: (text: string) => void;
}): Promise<string> {
  const key = process.env.ANTHROPIC_API_KEY ?? '';
  if (!key) throw new Error('ANTHROPIC_API_KEY não configurada no servidor.');

  const res = await fetch(ANTHROPIC_URL, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-api-key': key,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: process.env.ANTHROPIC_MODEL || DEFAULT_MODEL,
      max_tokens: 16000,
      stream: true,
      system: opts.system,
      messages: opts.messages,
    }),
    signal: opts.signal,
  });

  if (!res.ok || !res.body) {
    const detail = await res.text().catch(() => '');
    throw new Error(`API do Claude ${res.status}: ${detail.slice(0, 200)}`);
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let full = '';

  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    let idx: number;
    while ((idx = buffer.indexOf('\n')) !== -1) {
      const line = buffer.slice(0, idx).trim();
      buffer = buffer.slice(idx + 1);
      if (!line.startsWith('data:')) continue;
      const payload = line.slice(5).trim();
      if (!payload) continue;

      let evt: StreamEvent;
      try {
        evt = JSON.parse(payload) as StreamEvent;
      } catch {
        continue;
      }

      if (evt.type === 'content_block_delta' && evt.delta?.type === 'text_delta' && typeof evt.delta.text === 'string') {
        full += evt.delta.text;
        opts.onText(evt.delta.text);
      } else if (evt.type === 'error') {
        throw new Error(evt.error?.message ?? 'Erro na API do Claude.');
      }
    }
  }
  return full;
}
