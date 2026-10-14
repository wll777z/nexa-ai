import type { SiteContent, SiteBrief, ContactSection } from './site.model.js';

/**
 * Serviço de geração de conteúdo de sites.
 *
 * Duas fontes reais, nada de texto fingido:
 *
 * 1. IA externa (preferencial): quando AI_API_KEY está definida no ambiente do
 *    servidor, chamamos uma API compatível com OpenAI Chat Completions. A chave
 *    vive SOMENTE no servidor e nunca é enviada ao frontend.
 *
 * 2. Gerador local (fallback): sem chave, geramos o conteúdo analisando o
 *    briefing do usuário — extração real de segmento, serviços, contatos e tom.
 *    É determinístico e honesto: o frontend marca "gerado localmente".
 */

const AI_API_URL = process.env.AI_API_URL ?? 'https://api.openai.com/v1/chat/completions';
const AI_API_KEY = process.env.AI_API_KEY ?? '';
const AI_MODEL = process.env.AI_MODEL ?? 'gpt-4o-mini';

export type Source = 'ai' | 'local';

export function isAIConfigured(): boolean {
  return AI_API_KEY.length > 0;
}

const SYSTEM_PROMPT = `Você é um designer e redator de sites comerciais. A partir do briefing
de um negócio, produza o conteúdo completo de um site de uma página.

Responda APENAS com um objeto JSON (sem markdown, sem cercas de código), com exatamente:
{
  "layout": "<um de: barbearia | salao | restaurante | loja | clinica | servico | generico>",
  "hero": { "title": "...", "subtitle": "...", "cta": "...", "ctaLink": "..." },
  "about": { "title": "Sobre nós", "text": "2 a 3 frases reais sobre o negócio" },
  "differentials": { "title": "Diferenciais", "items": ["...","...","..."] },
  "services": { "title": "Serviços", "items": ["...","...","..."] },
  "faq": { "title": "Perguntas frequentes", "items": [ { "q": "...", "a": "..." } ] },
  "gallery": { "title": "Galeria", "images": [] },
  "contact": { "title": "Contato", "whatsapp": "", "email": "", "phone": "", "address": "", "instagram": "" },
  "footer": { "text": "..." },
  "colors": { "primary": "#RRGGBB", "background": "#RRGGBB" }
}

Regras:
- Escreva em português do Brasil, tom profissional e específico do negócio.
- NÃO invente depoimentos, avaliações, clientes, números de telefone, e-mails,
  endereços ou redes sociais. Deixe vazio ("") o que não foi informado no briefing.
- Escolha "layout" de acordo com o segmento. A paleta deve combinar com o segmento.
- 3 a 5 diferenciais e 3 a 6 serviços, ambos descritivos e reais.`;

/** Entrada principal: escolhe a fonte e devolve conteúdo + origem. */
export async function generateSite(
  brief: SiteBrief,
): Promise<{ content: SiteContent; source: Source }> {
  if (isAIConfigured()) {
    try {
      const content = await generateWithAI(brief);
      return { content, source: 'ai' };
    } catch (err) {
      console.error('[AI] falha, usando gerador local:', err);
      return { content: generateLocally(brief), source: 'local' };
    }
  }
  return { content: generateLocally(brief), source: 'local' };
}

function briefToText(b: SiteBrief): string {
  return [
    `Empresa: ${b.companyName}`,
    b.segment && `Segmento: ${b.segment}`,
    b.description && `Descrição: ${b.description}`,
    b.targetAudience && `Público-alvo: ${b.targetAudience}`,
    b.services && `Serviços/produtos: ${b.services}`,
    b.phone && `Telefone: ${b.phone}`,
    b.whatsapp && `WhatsApp: ${b.whatsapp}`,
    b.email && `E-mail: ${b.email}`,
    b.address && `Endereço: ${b.address}`,
    b.instagram && `Instagram: ${b.instagram}`,
    b.goal && `Objetivo do site: ${b.goal}`,
    b.style && `Estilo desejado: ${b.style}`,
  ]
    .filter(Boolean)
    .join('\n');
}

async function generateWithAI(brief: SiteBrief): Promise<SiteContent> {
  const res = await fetch(AI_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      // Cloudflare do provedor bloqueia clientes sem User-Agent (erro 403/1010)
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) NEXA-AI/1.0',
      Accept: 'application/json',
      Authorization: `Bearer ${AI_API_KEY}`,
    },
    body: JSON.stringify({
      model: AI_MODEL,
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: `Briefing do negócio:\n${briefToText(brief)}` },
      ],
      temperature: 0.7,
      // modelos de raciocínio (gpt-oss) gastam tokens "pensando" antes de
      // responder; com max_tokens baixo a resposta vem vazia.
      max_tokens: 4000,
    }),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`API de IA ${res.status}: ${text.slice(0, 200)}`);
  }

  const data = (await res.json()) as {
    choices?: { message?: { content?: string; reasoning?: string } }[];
  };
  const msg = data.choices?.[0]?.message;
  // modelos de raciocínio podem devolver o texto em reasoning; aceitamos ambos.
  const raw = msg?.content?.trim() || msg?.reasoning?.trim();
  if (!raw) throw new Error('Resposta da IA sem conteúdo.');
  // extrai o primeiro objeto JSON da resposta (evita texto ao redor)
  const jsonMatch = raw.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error('IA não retornou JSON.');
  const parsed = JSON.parse(jsonMatch[0]) as Partial<SiteContent>;
  return normalize(parsed, brief);
}

// ── Gerador local ──────────────────────────────────────────────────────────
// Analisa o briefing de verdade. Não é "IA", é extração heurística — e a
// interface diz exatamente isso ao usuário.

const SEGMENTS = [
  { key: 'barbearia', label: 'barbearia', layout: 'barbearia', services: ['Corte masculino', 'Barba', 'Atendimento por agendamento'], tone: 'clássico e moderno', colors: ['#b45309', '#0c0a09'] },
  { key: 'salao', label: 'salão de beleza', layout: 'salao', services: ['Corte e escova', 'Coloração', 'Manicure e pedicure', 'Estética'], tone: 'elegante e acolhedor', colors: ['#be185d', '#1c1917'] },
  { key: 'salão', label: 'salão de beleza', layout: 'salao', services: ['Corte e escova', 'Coloração', 'Manicure e pedicure', 'Estética'], tone: 'elegante e acolhedor', colors: ['#be185d', '#1c1917'] },
  { key: 'estetica', label: 'clínica de estética', layout: 'salao', services: ['Limpeza de pele', 'Massagem', 'Tratamentos faciais'], tone: 'cuidadoso', colors: ['#0d9488', '#f8fafc'] },
  { key: 'estética', label: 'clínica de estética', layout: 'salao', services: ['Limpeza de pele', 'Massagem', 'Tratamentos faciais'], tone: 'cuidadoso', colors: ['#0d9488', '#f8fafc'] },
  { key: 'restaurante', label: 'restaurante', layout: 'restaurante', services: ['Almoço', 'Jantar', 'Delivery', 'Reservas'], tone: 'acolhedor', colors: ['#dc2626', '#1c1917'] },
  { key: 'lanchonete', label: 'lanchonete', layout: 'restaurante', services: ['Lanches', 'Porções', 'Delivery'], tone: 'descontraído', colors: ['#ea580c', '#1c1917'] },
  { key: 'pizzaria', label: 'pizzaria', layout: 'restaurante', services: ['Pizzas', 'Delivery', 'Retirada no local'], tone: 'acolhedor', colors: ['#dc2626', '#1c1917'] },
  { key: 'loja', label: 'loja', layout: 'loja', services: ['Catálogo de produtos', 'Vitrine online', 'Contato por WhatsApp'], tone: 'moderno', colors: ['#7c3aed', '#0a0a0b'] },
  { key: 'clinica', label: 'clínica', layout: 'clinica', services: ['Consultas', 'Exames', 'Agendamento online'], tone: 'confiável', colors: ['#0ea5e9', '#f8fafc'] },
  { key: 'clínica', label: 'clínica', layout: 'clinica', services: ['Consultas', 'Exames', 'Agendamento online'], tone: 'confiável', colors: ['#0ea5e9', '#f8fafc'] },
  { key: 'odont', label: 'consultório odontológico', layout: 'clinica', services: ['Avaliação', 'Clareamento', 'Ortodontia'], tone: 'cuidadoso', colors: ['#0891b2', '#f8fafc'] },
  { key: 'academia', label: 'academia', layout: 'servico', services: ['Musculação', 'Aulas coletivas', 'Personal trainer'], tone: 'energético', colors: ['#16a34a', '#0a0a0b'] },
  { key: 'pet', label: 'pet shop', layout: 'loja', services: ['Banho e tosa', 'Rações', 'Veterinário'], tone: 'amigável', colors: ['#f59e0b', '#1c1917'] },
  { key: 'escola', label: 'escola', layout: 'servico', services: ['Matrículas', 'Grade curricular', 'Contato'], tone: 'institucional', colors: ['#2563eb', '#f8fafc'] },
  { key: 'oficina', label: 'oficina mecânica', layout: 'servico', services: ['Revisão', 'Funilaria', 'Orçamento'], tone: 'prático', colors: ['#334155', '#f8fafc'] },
  { key: 'eletric', label: 'serviços de elétrica', layout: 'servico', services: ['Instalações', 'Manutenção', 'Orçamento'], tone: 'prático', colors: ['#334155', '#f8fafc'] },
  { key: 'encan', label: 'serviços de hidráulica', layout: 'servico', services: ['Reparos', 'Instalações', 'Orçamento'], tone: 'prático', colors: ['#334155', '#f8fafc'] },
];

const CONTACT_PATTERNS = {
  anyPhone: /(\(?\d{2}\)?\s?\d{4,5}-?\d{4})/,
  email: /[\w.+-]+@[\w-]+\.[\w.-]+/,
};

function detectSegment(brief: SiteBrief) {
  const hay = `${brief.segment ?? ''} ${brief.description ?? ''}`.toLowerCase();
  for (const s of SEGMENTS) {
    if (hay.includes(s.key)) return s;
  }
  return null;
}

function extractContacts(brief: SiteBrief) {
  // Os campos explícitos do formulário têm prioridade sobre regex no texto.
  const anyPhone =
    brief.phone || brief.whatsapp ||
    `${brief.description ?? ''}`.match(CONTACT_PATTERNS.anyPhone)?.[1] || '';
  const email =
    brief.email || `${brief.description ?? ''}`.match(CONTACT_PATTERNS.email)?.[0] || '';
  const whatsapp = brief.whatsapp || anyPhone;
  return {
    whatsapp,
    phone: brief.phone || anyPhone,
    email,
    address: brief.address ?? '',
    instagram: brief.instagram ?? '',
  };
}

function extractExtraServices(brief: SiteBrief, base: string[]): string[] {
  const src = brief.services ?? '';
  if (!src.trim()) return base;
  const listed = src
    .split(/,|;| e /i)
    .map((s) => s.trim())
    .filter((s) => s.length > 2 && s.length < 40);
  return listed.length >= 2 ? listed : base;
}

function generateLocally(brief: SiteBrief): SiteContent {
  const seg = detectSegment(brief);
  const contacts = extractContacts(brief);
  const services = extractExtraServices(brief, seg?.services ?? ['Atendimento personalizado', 'Qualidade garantida']);
  const label = seg?.label ?? (brief.segment || 'seu negócio');
  const tone = seg?.tone ?? 'profissional';
  const name = brief.companyName || label;
  const [primary, background] = seg?.colors ?? ['#6366f1', '#0a0a0b'];

  return normalize(
    {
      layout: (seg?.layout as SiteContent['layout']) ?? 'generico',
      hero: {
        title: name,
        subtitle: brief.description?.trim().slice(0, 120) ||
          `Tudo o que você precisa em ${label} — com atendimento ${tone}.`,
        cta: contacts.whatsapp ? 'Fale conosco no WhatsApp' : 'Fale conosco',
        ctaLink: contacts.whatsapp ? `https://wa.me/${digits(contacts.whatsapp)}` : '',
      },
      about: {
        title: 'Sobre nós',
        text: brief.description?.trim() ||
          `Somos referência em ${label}, oferecendo um atendimento ${tone} e soluções sob medida para você.`,
      },
      differentials: {
        title: 'Diferenciais',
        items: [`Atendimento ${tone}`, 'Equipe qualificada', 'Ambiente preparado para você'],
      },
      services: { title: 'Serviços', items: services },
      faq: { title: 'Perguntas frequentes', items: [] },
      gallery: { title: 'Galeria', images: [] },
      contact: { title: 'Contato', ...contacts },
      footer: { text: `${name} — ${label}. Todos os direitos reservados.` },
      colors: { primary, background },
    },
    brief,
  );
}

function digits(s: string): string {
  return s.replace(/\D/g, '');
}

/** Garante que todo campo exista e tenha a forma correta. */
export function normalize(input: Partial<SiteContent>, brief: SiteBrief): SiteContent {
  const name = brief.companyName || 'Seu negócio';
  const contacts: Partial<ContactSection> = input.contact ?? {};
  return {
    layout: input.layout ?? 'generico',
    hero: {
      title: input.hero?.title || name,
      subtitle: input.hero?.subtitle || 'Bem-vindo ao nosso site.',
      cta: input.hero?.cta || 'Fale conosco',
      ctaLink: input.hero?.ctaLink ?? '',
    },
    about: {
      title: input.about?.title || 'Sobre nós',
      text: input.about?.text || '',
    },
    differentials: {
      title: input.differentials?.title || 'Diferenciais',
      items: Array.isArray(input.differentials?.items) ? input.differentials!.items : [],
    },
    services: {
      title: input.services?.title || 'Serviços',
      items: Array.isArray(input.services?.items) ? input.services!.items : [],
    },
    faq: {
      title: input.faq?.title || 'Perguntas frequentes',
      items: Array.isArray(input.faq?.items) ? input.faq!.items : [],
    },
    gallery: {
      title: input.gallery?.title || 'Galeria',
      images: Array.isArray(input.gallery?.images) ? input.gallery!.images : [],
    },
    contact: {
      title: input.contact?.title || 'Contato',
      whatsapp: contacts.whatsapp ?? '',
      email: contacts.email ?? '',
      phone: contacts.phone ?? '',
      address: contacts.address ?? '',
      instagram: contacts.instagram ?? '',
    },
    footer: { text: input.footer?.text || `${name} — Todos os direitos reservados.` },
    colors: {
      primary: input.colors?.primary || '#6366f1',
      background: input.colors?.background || '#0a0a0b',
    },
  };
}
