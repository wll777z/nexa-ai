import { get } from '../../db/index.js';
import type { LeadPriority } from './prospecting.model.js';
import type { FoundCompany } from './prospecting.service.js';

/**
 * IA para prospecção: gera mensagens personalizadas e classifica prioridade.
 *
 * Usa a mesma API Groq/OpenAI-compatível já configurada para o criador de sites.
 * Fallback: regras determinísticas (sem IA) — a interface indica a origem.
 *
 * Regras de segurança (LGPD + honestidade):
 * - NUNCA inventa que visitou a empresa, conhece o dono, etc.
 * - Usa apenas fatos fornecidos: nome, categoria, cidade.
 * - Mensagem curta, profissional e natural.
 */

const AI_API_URL = process.env.AI_API_URL ?? 'https://api.groq.com/openai/v1/chat/completions';
const AI_API_KEY = process.env.AI_API_KEY ?? '';
const AI_MODEL = process.env.AI_MODEL ?? 'llama-3.3-70b-versatile';

export function isAIConfigured(): boolean {
  return AI_API_KEY.length > 0;
}

// ── Geração de mensagem ──────────────────────────────────────────────────────

export async function generateProspectMessage(
  template: string,
  service: string,
  companyName: string,
  leadName: string,
  category: string | null,
  city: string | null,
): Promise<string> {
  if (isAIConfigured()) {
    try {
      return await generateWithAI(template, service, companyName, leadName, category, city);
    } catch (err) {
      console.error('[Prospecção AI] falha, usando regras:', err);
    }
  }
  return generateByRules(template, service, companyName, leadName, category, city);
}

const MESSAGE_SYSTEM_PROMPT = `Você é um especialista em prospecção comercial B2B no Brasil.
Gere uma mensagem curta (máximo 3 frases), profissional e natural para enviar
a uma empresa via WhatsApp ou e-mail.

Regras OBRIGATÓRIAS:
- Use APENAS fatos fornecidos: nome da empresa, segmento/categoria, cidade.
- NUNCA afirme que visitou a empresa, que conhece o proprietário ou que
  conversou com alguém do local.
- NUNCA afirme que a empresa "precisa" do serviço sem evidência.
- Tom: profissional, respeitoso, direto. Sem emojis em excesso (máximo 1).
- Termine com uma pergunta aberta convidando à conversa.
- Responda APENAS com o texto da mensagem, sem explicações.`;

async function generateWithAI(
  template: string,
  service: string,
  companyName: string,
  leadName: string,
  category: string | null,
  city: string | null,
): Promise<string> {
  const userPrompt = [
    `Template base: "${template}"`,
    `Meu serviço: ${service}`,
    `Minha empresa: ${companyName}`,
    `Empresa alvo: ${leadName}`,
    category ? `Segmento: ${category}` : '',
    city ? `Cidade: ${city}` : '',
    '',
    'Gere a mensagem personalizada seguindo as regras.',
  ].filter(Boolean).join('\n');

  const res = await fetch(AI_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) NEXA-AI/1.0',
      Accept: 'application/json',
      Authorization: `Bearer ${AI_API_KEY}`,
    },
    body: JSON.stringify({
      model: AI_MODEL,
      messages: [
        { role: 'system', content: MESSAGE_SYSTEM_PROMPT },
        { role: 'user', content: userPrompt },
      ],
      temperature: 0.6,
      max_tokens: 300,
    }),
  });

  if (!res.ok) throw new Error(`API IA ${res.status}`);
  const data = (await res.json()) as {
    choices?: { message?: { content?: string } }[];
  };
  const content = data.choices?.[0]?.message?.content?.trim();
  if (!content) throw new Error('Resposta da IA sem conteúdo.');
  return content;
}

function generateByRules(
  template: string,
  service: string,
  companyName: string,
  leadName: string,
  category: string | null,
  city: string | null,
): string {
  let msg = template;
  msg = msg.replace(/\[NOME DA EMPRESA\]/g, leadName);
  msg = msg.replace(/\[SERVIÇO\]/g, service || 'soluções digitais');
  msg = msg.replace(/\[MINHA EMPRESA\]/g, companyName || 'nossa empresa');
  msg = msg.replace(/\[CATEGORIA\]/g, category ?? '');
  msg = msg.replace(/\[CIDADE\]/g, city ?? '');
  if (city && !msg.includes(city)) {
    msg = msg.replace(/\.\s*$/, ` em ${city}.`);
  }
  return msg.trim();
}

// ── Classificação de prioridade ──────────────────────────────────────────────

export async function analyzeLeadPriority(
  company: FoundCompany,
  _orgId: number,
): Promise<{ priority: LeadPriority; reason: string }> {
  // Regras determinísticas primeiro (sempre disponíveis)
  const ruleResult = classifyByRules(company);

  if (isAIConfigured()) {
    try {
      const aiResult = await classifyWithAI(company);
      if (aiResult) return aiResult;
    } catch (err) {
      console.error('[Prospecção AI] falha na classificação, usando regras:', err);
    }
  }

  return ruleResult;
}

function classifyByRules(company: FoundCompany): { priority: LeadPriority; reason: string } {
  let score = 0;
  const reasons: string[] = [];

  // Sem site = oportunidade digital
  if (!company.website) {
    score += 3;
    reasons.push('Não possui site — oportunidade de presença digital.');
  } else {
    score += 1;
    reasons.push('Já possui site — pode precisar de melhoria ou gestão.');
  }

  // Sem telefone visível = pode precisar de canal de contato
  if (!company.phone) {
    score += 2;
    reasons.push('Telefone não disponível publicamente — pode precisar de canal digital.');
  } else {
    reasons.push('Telefone público disponível para contato direto.');
  }

  // Categoria definida = segmento identificado
  if (company.category) {
    score += 1;
    reasons.push(`Segmento identificado: ${company.category}.`);
  }

  if (score >= 5) return { priority: 'alta', reason: reasons.join(' ') };
  if (score >= 3) return { priority: 'media', reason: reasons.join(' ') };
  return { priority: 'baixa', reason: reasons.join(' ') };
}

async function classifyWithAI(
  company: FoundCompany,
): Promise<{ priority: LeadPriority; reason: string } | null> {
  const prompt = `Analise esta empresa para prospecção comercial:
Nome: ${company.name}
Categoria: ${company.category}
Cidade: ${company.city}
Tem site: ${company.website ? 'sim' : 'não'}
Tem telefone público: ${company.phone ? 'sim' : 'não'}

Responda em JSON: {"priority": "alta|media|baixa", "reason": "explicação curta em português, máx 2 frases, sem inventar fatos"}
Considere: empresas sem presença digital são leads de maior prioridade para serviços digitais.`;

  const res = await fetch(AI_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) NEXA-AI/1.0',
      Authorization: `Bearer ${AI_API_KEY}`,
    },
    body: JSON.stringify({
      model: AI_MODEL,
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.3,
      max_tokens: 200,
    }),
  });

  if (!res.ok) return null;
  const data = (await res.json()) as {
    choices?: { message?: { content?: string } }[];
  };
  const raw = data.choices?.[0]?.message?.content?.trim();
  if (!raw) return null;

  const jsonMatch = raw.match(/\{[\s\S]*\}/);
  if (!jsonMatch) return null;
  const parsed = JSON.parse(jsonMatch[0]) as { priority?: string; reason?: string };
  if (!parsed.priority || !parsed.reason) return null;

  const priority = (['alta', 'media', 'baixa'] as const).includes(parsed.priority as LeadPriority)
    ? (parsed.priority as LeadPriority)
    : 'media';

  return { priority, reason: parsed.reason };
}
