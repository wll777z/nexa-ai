import { all, get, run, transaction } from '../../db/index.js';
import { logger } from '../../utils/logger.js';
import { badRequest, notFound } from '../../utils/errors.js';
import { generateProspectMessage, analyzeLeadPriority, isAIConfigured } from './prospecting.ai.js';
import type { ActivityEntry, Lead, LeadPriority, LeadStatus, ProspectingConfig } from './prospecting.model.js';

/**
 * Busca de empresas por segmento/região.
 *
 * Fontes suportadas:
 * 1. Google Maps Places API (quando GOOGLE_MAPS_API_KEY está configurada).
 *    Respeita os Termos de Uso: usamos apenas dados retornados pela API,
 *    não burlamos CAPTCHA, não acessamos áreas privadas.
 * 2. Modo demonstração (padrão): gera dados FICTÍCIOS claramente rotulados
 *    com is_demo = 1, para o usuário testar o fluxo sem integração real.
 *
 * Nunca expomos a chave — ela vive só no servidor.
 */

interface SearchInput {
  segments: string[];
  region: string;
  maxResults: number;
}

export interface FoundCompany {
  name: string;
  category: string;
  city: string;
  neighborhood: string | null;
  website: string | null;
  phone: string | null;
  source: string;
  sourceId: string | null;
  reason: string;
  priority: LeadPriority;
  isDemo: boolean;
}

const GOOGLE_MAPS_KEY = process.env.GOOGLE_MAPS_API_KEY ?? '';

export function isGoogleMapsConfigured(): boolean {
  return GOOGLE_MAPS_KEY.length > 0;
}

/** Chave de deduplicação: nome normalizado + cidade. */
function dedupeKey(name: string, city: string): string {
  return `${name.toLowerCase().replace(/[^a-z0-9]/g, '')}|${city.toLowerCase().replace(/[^a-z0-9]/g, '')}`;
}

export async function searchCompanies(input: SearchInput): Promise<FoundCompany[]> {
  const results: FoundCompany[] = [];
  const seen = new Set<string>();

  for (const segment of input.segments) {
    const found = isGoogleMapsConfigured()
      ? await searchGoogleMaps(segment, input.region, input.maxResults)
      : searchDemo(segment, input.region, input.maxResults);

    for (const c of found) {
      const key = dedupeKey(c.name, c.city);
      if (seen.has(key)) continue;
      seen.add(key);
      results.push(c);
      if (results.length >= input.maxResults) break;
    }
    if (results.length >= input.maxResults) break;
  }

  return results;
}

// ── Fonte 1: Google Maps Places API (dados reais) ───────────────────────────
//
// Fluxo em duas etapas:
//  1. Text Search encontra os estabelecimentos do segmento na região.
//  2. Place Details busca telefone e site de cada resultado (a Text Search
//     básica não devolve esses campos). Limitamos os detalhes a `max`
//     lugares para controlar custo/cota.
//
// Respeita os Termos de Uso do Google: usamos apenas dados retornados pela
// API. A chave vive só no servidor e nunca é exposta ao frontend.

interface PlaceTextResult {
  place_id: string;
  name: string;
  formatted_address?: string;
}

interface PlaceDetails {
  name?: string;
  formatted_address?: string;
  formatted_phone_number?: string;
  international_phone_number?: string;
  website?: string;
  address_components?: Array<{ long_name: string; types: string[] }>;
}

function extractCityNeighborhood(components: PlaceDetails['address_components']): {
  city: string;
  neighborhood: string;
} {
  let city = '';
  let neighborhood = '';
  for (const c of components ?? []) {
    if (c.types.includes('administrative_area_level_2') || c.types.includes('locality')) {
      city = c.long_name;
    }
    if (c.types.includes('sublocality') || c.types.includes('neighborhood')) {
      neighborhood = c.long_name;
    }
  }
  return { city, neighborhood };
}

async function fetchPlaceDetails(placeId: string): Promise<PlaceDetails | null> {
  const params = new URLSearchParams({
    place_id: placeId,
    key: GOOGLE_MAPS_KEY,
    language: 'pt-BR',
    fields: 'name,formatted_address,formatted_phone_number,international_phone_number,website,address_components',
  });
  const res = await fetch(
    `https://maps.googleapis.com/maps/api/place/details/json?${params.toString()}`,
    { headers: { 'User-Agent': 'NEXA-AI/1.0' } },
  );
  if (!res.ok) return null;
  const data = (await res.json()) as { status: string; result?: PlaceDetails };
  if (data.status !== 'OK' || !data.result) return null;
  return data.result;
}

async function searchGoogleMaps(
  segment: string,
  region: string,
  max: number,
): Promise<FoundCompany[]> {
  // Etapa 1: Text Search
  const params = new URLSearchParams({
    query: `${segment} em ${region}`,
    key: GOOGLE_MAPS_KEY,
    language: 'pt-BR',
    type: 'establishment',
  });

  const res = await fetch(
    `https://maps.googleapis.com/maps/api/place/textsearch/json?${params.toString()}`,
    { headers: { 'User-Agent': 'NEXA-AI/1.0' } },
  );

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    logger.error('[Prospecção] Google Maps erro', { status: res.status, body: text.slice(0, 200) });
    throw new Error(`Google Maps API retornou ${res.status}`);
  }

  const data = (await res.json()) as {
    status: string;
    error_message?: string;
    results?: PlaceTextResult[];
  };

  if (data.status !== 'OK' || !data.results) {
    logger.warn('[Prospecção] Google Maps status inesperado', {
      status: data.status,
      error: data.error_message,
    });
    return [];
  }

  // Etapa 2: Place Details para telefone/site de cada resultado
  const results: FoundCompany[] = [];
  for (const r of data.results.slice(0, max)) {
    const details = await fetchPlaceDetails(r.place_id);
    const { city, neighborhood } = extractCityNeighborhood(details?.address_components);
    results.push({
      name: r.name,
      category: segment,
      city: city || region,
      neighborhood: neighborhood || null,
      website: details?.website ?? null,
      phone: details?.formatted_phone_number ?? details?.international_phone_number ?? null,
      source: 'google_maps',
      sourceId: r.place_id,
      reason: '',
      priority: 'media' as LeadPriority,
      isDemo: false,
    });
  }

  return results;
}

// ── Fonte 2: Modo demonstração (dados fictícios rotulados) ────────────────────

const DEMO_SUFFIXES = [
  'Centro', 'Zona Sul', 'Zona Norte', 'Jardim Europa', 'Vila Nova',
  'Bela Vista', 'Planalto', 'Alvorada', 'Industrial', 'São José',
];

const DEMO_FIRST_NAMES = [
  'Barbearia', 'Salão', 'Studio', 'Espaço', 'Ateliê', 'Casa', 'Ponto',
  'Núcleo', 'Cantinho', 'Clube',
];

const DEMO_SECOND_NAMES = [
  'do Zé', 'da Maria', 'Estilo', 'Charme', 'Vip', 'Premium', 'Arte',
  'Estética', 'Bem Estar', 'Style',
];

function searchDemo(segment: string, region: string, max: number): FoundCompany[] {
  const count = Math.min(max, 5);
  const results: FoundCompany[] = [];
  const usedKeys = new Set<string>();

  for (let i = 0; i < count; i++) {
    let name: string;
    do {
      const first = DEMO_FIRST_NAMES[Math.floor(Math.random() * DEMO_FIRST_NAMES.length)];
      const second = DEMO_SECOND_NAMES[Math.floor(Math.random() * DEMO_SECOND_NAMES.length)];
      name = `${first} ${second} — ${segment}`;
    } while (usedKeys.has(dedupeKey(name, region)) && usedKeys.size < 50);
    usedKeys.add(dedupeKey(name, region));

    const neighborhood = DEMO_SUFFIXES[Math.floor(Math.random() * DEMO_SUFFIXES.length)];
    const phone = Math.random() > 0.3
      ? `(67) 9${String(Math.floor(Math.random() * 9000) + 1000)}-${String(Math.floor(Math.random() * 9000) + 1000)}`
      : null;

    results.push({
      name,
      category: segment,
      city: region,
      neighborhood,
      website: Math.random() > 0.4 ? `https://${slug(name)}.com.br` : null,
      phone,
      source: 'demo',
      sourceId: null,
      reason: '',
      priority: 'media',
      isDemo: true,
    });
  }

  return results;
}

function slug(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]/g, '')
    .slice(0, 20);
}

// ── Persistência com deduplicação ────────────────────────────────────────────

/**
 * Salva empresas encontradas no banco, pulando duplicatas e suprimidos.
 * Retorna quantas foram inseridas e quantas puladas.
 */
export async function saveLeads(
  orgId: number,
  companies: FoundCompany[],
): Promise<{ inserted: number; skipped: number }> {
  let inserted = 0;
  let skipped = 0;

  for (const c of companies) {
    const key = dedupeKey(c.name, c.city);

    // Verifica lista de supressão
    const suppressed = get<{ id: number }>(
      'SELECT id FROM prospecting_suppressions WHERE organization_id = ? AND dedupe_key = ?',
      [orgId, key],
    );
    if (suppressed) { skipped++; continue; }

    // Verifica duplicata (UNIQUE index protege, mas checamos para contar)
    const existing = get<{ id: number }>(
      'SELECT id FROM prospecting_leads WHERE organization_id = ? AND dedupe_key = ?',
      [orgId, key],
    );
    if (existing) { skipped++; continue; }

    // Análise de prioridade + motivo (IA ou regras)
    const { priority, reason } = await analyzeLeadPriority(c, orgId);

    transaction(() => {
      run(
        `INSERT INTO prospecting_leads
         (organization_id, name, category, city, neighborhood, website, phone,
          source, source_id, reason, priority, status, dedupe_key, is_demo)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'novo_lead', ?, ?)`,
        [orgId, c.name, c.category, c.city, c.neighborhood, c.website, c.phone,
         c.source, c.sourceId, reason, priority, key, c.isDemo ? 1 : 0],
      );
    });
    inserted++;
  }

  if (inserted > 0 || skipped > 0) {
    logger.info('[Prospecção] busca concluída', { orgId, inserted, skipped });
  }

  return { inserted, skipped };
}

// ── Listagem com filtros ─────────────────────────────────────────────────────

export function listLeads(
  orgId: number,
  filters: {
    status?: LeadStatus;
    priority?: LeadPriority;
    search?: string;
    includeDemo?: boolean;
  } = {},
): Lead[] {
  let sql = 'SELECT * FROM prospecting_leads WHERE organization_id = ?';
  const params: unknown[] = [orgId];

  if (filters.status) {
    sql += ' AND status = ?';
    params.push(filters.status);
  }
  if (filters.priority) {
    sql += ' AND priority = ?';
    params.push(filters.priority);
  }
  if (!filters.includeDemo) {
    sql += ' AND is_demo = 0';
  }
  if (filters.search) {
    sql += ' AND (name LIKE ? OR category LIKE ? OR city LIKE ?)';
    const like = `%${filters.search}%`;
    params.push(like, like, like);
  }

  sql += " ORDER BY CASE priority WHEN 'alta' THEN 0 WHEN 'media' THEN 1 ELSE 2 END, updated_at DESC";

  return all<Record<string, unknown>>(sql, params).map(mapLeadRow);
}

function mapLeadRow(r: Record<string, unknown>): Lead {
  return {
    id: r.id as number,
    name: r.name as string,
    category: (r.category as string) || null,
    city: (r.city as string) || null,
    neighborhood: (r.neighborhood as string) || null,
    website: (r.website as string) || null,
    phone: (r.phone as string) || null,
    source: r.source as string,
    reason: (r.reason as string) || null,
    priority: r.priority as LeadPriority,
    status: r.status as LeadStatus,
    isDemo: (r.is_demo as number) === 1,
    createdAt: r.created_at as string,
    updatedAt: r.updated_at as string,
    lastContactAt: (r.last_contact_at as string) || null,
    nextAction: (r.next_action as string) || null,
  };
}

// ── Configuração ─────────────────────────────────────────────────────────────

export function getConfig(orgId: number): ProspectingConfig | null {
  const r = get<Record<string, unknown>>(
    'SELECT * FROM prospecting_configs WHERE organization_id = ?',
    [orgId],
  );
  if (!r) return null;
  return {
    id: r.id as number,
    organizationId: r.organization_id as number,
    service: (r.service as string) || '',
    companyName: (r.company_name as string) || '',
    description: (r.description as string) || '',
    region: (r.region as string) || '',
    segments: JSON.parse((r.segments as string) || '[]') as string[],
    maxPerSearch: (r.max_per_search as number) || 10,
    channel: (r.channel as ProspectingConfig['channel']) || 'manual',
    messageTemplate: (r.message_template as string) || '',
    maxContactsDay: (r.max_contacts_day as number) || 20,
    autoApprove: (r.auto_approve as number) === 1,
    createdAt: r.created_at as string,
    updatedAt: r.updated_at as string,
  };
}

export function saveConfig(
  orgId: number,
  data: Partial<ProspectingConfig>,
): ProspectingConfig {
  const current = getConfig(orgId);
  const merged = { ...current, ...data, organizationId: orgId };

  if (current) {
    run(
      `UPDATE prospecting_configs
       SET service = ?, company_name = ?, description = ?, region = ?,
           segments = ?, max_per_search = ?, channel = ?, message_template = ?,
           max_contacts_day = ?, auto_approve = ?, updated_at = datetime('now')
       WHERE organization_id = ?`,
      [
        merged.service ?? '',
        merged.companyName ?? '',
        merged.description ?? '',
        merged.region ?? '',
        JSON.stringify(merged.segments ?? []),
        merged.maxPerSearch ?? 10,
        merged.channel ?? 'manual',
        merged.messageTemplate ?? '',
        merged.maxContactsDay ?? 20,
        (merged.autoApprove ? 1 : 0),
        orgId,
      ],
    );
  } else {
    run(
      `INSERT INTO prospecting_configs
       (organization_id, service, company_name, description, region, segments,
        max_per_search, channel, message_template, max_contacts_day, auto_approve)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        orgId,
        merged.service ?? '',
        merged.companyName ?? '',
        merged.description ?? '',
        merged.region ?? '',
        JSON.stringify(merged.segments ?? []),
        merged.maxPerSearch ?? 10,
        merged.channel ?? 'manual',
        merged.messageTemplate ?? '',
        merged.maxContactsDay ?? 20,
        (merged.autoApprove ? 1 : 0),
      ],
    );
  }

  return getConfig(orgId)!;
}

// ── Mensagens ────────────────────────────────────────────────────────────────

export async function createMessageForLead(
  orgId: number,
  leadId: number,
): Promise<{ id: number; content: string; status: string }> {
  const lead = get<Record<string, unknown>>(
    'SELECT * FROM prospecting_leads WHERE id = ? AND organization_id = ?',
    [leadId, orgId],
  );
  if (!lead) throw notFound('Lead não encontrado.');

  const config = getConfig(orgId);
  const template = config?.messageTemplate ||
    'Olá! Tudo bem? Encontrei o perfil comercial da [NOME DA EMPRESA] e gostaria de apresentar meu trabalho com [SERVIÇO]. Posso te enviar algumas informações?';

  const content = await generateProspectMessage(
    template,
    config?.service ?? '',
    config?.companyName ?? '',
    lead.name as string,
    lead.category as string | null,
    lead.city as string | null,
  );

  const r = run(
    `INSERT INTO prospecting_messages (organization_id, lead_id, content, status)
     VALUES (?, ?, ?, 'pendente')`,
    [orgId, leadId, content],
  );

  run(
    `UPDATE prospecting_leads SET status = 'aguardando_aprovacao', updated_at = datetime('now')
     WHERE id = ? AND organization_id = ?`,
    [leadId, orgId],
  );

  logActivity(orgId, 'message_created', 'lead', leadId, `Mensagem gerada para "${lead.name}"`);

  return { id: Number(r.lastInsertRowid), content, status: 'pendente' };
}

export function approveMessage(orgId: number, messageId: number, userId: number): void {
  const msg = get<Record<string, unknown>>(
    'SELECT * FROM prospecting_messages WHERE id = ? AND organization_id = ?',
    [messageId, orgId],
  );
  if (!msg) throw notFound('Mensagem não encontrada.');
  if (msg.status !== 'pendente') throw badRequest('Mensagem já processada.');

  run(
    `UPDATE prospecting_messages
     SET status = 'aprovada', approved_by = ?, approved_at = datetime('now'), updated_at = datetime('now')
     WHERE id = ? AND organization_id = ?`,
    [userId, messageId, orgId],
  );

  run(
    `UPDATE prospecting_leads SET status = 'aprovado_contato', updated_at = datetime('now')
     WHERE id = ? AND organization_id = ?`,
    [msg.lead_id as number, orgId],
  );

  logActivity(orgId, 'message_approved', 'message', messageId, `Mensagem aprovada (lead ${msg.lead_id})`);
}

export function rejectMessage(orgId: number, messageId: number): void {
  run(
    `UPDATE prospecting_messages SET status = 'recusada', updated_at = datetime('now')
     WHERE id = ? AND organization_id = ?`,
    [messageId, orgId],
  );
  const msg = get<{ lead_id: number }>(
    'SELECT lead_id FROM prospecting_messages WHERE id = ? AND organization_id = ?',
    [messageId, orgId],
  );
  if (msg) {
    run(
      `UPDATE prospecting_leads SET status = 'novo_lead', updated_at = datetime('now')
       WHERE id = ? AND organization_id = ?`,
      [msg.lead_id, orgId],
    );
  }
  logActivity(orgId, 'message_rejected', 'message', messageId, `Mensagem recusada`);
}

export function listMessages(
  orgId: number,
  status?: string,
): Array<Record<string, unknown>> {
  let sql = 'SELECT m.*, l.name as lead_name FROM prospecting_messages m JOIN prospecting_leads l ON m.lead_id = l.id WHERE m.organization_id = ?';
  const params: unknown[] = [orgId];
  if (status) {
    sql += ' AND m.status = ?';
    params.push(status);
  }
  sql += ' ORDER BY m.created_at DESC LIMIT 200';
  return all<Record<string, unknown>>(sql, params);
}

// ── Supressão ────────────────────────────────────────────────────────────────

export function suppressLead(orgId: number, leadId: number, reason: string): void {
  const lead = get<Record<string, unknown>>(
    'SELECT * FROM prospecting_leads WHERE id = ? AND organization_id = ?',
    [leadId, orgId],
  );
  if (!lead) throw notFound('Lead não encontrado.');

  const key = lead.dedupe_key as string;
  transaction(() => {
    run(
      `INSERT INTO prospecting_suppressions (organization_id, lead_id, dedupe_key, reason)
       VALUES (?, ?, ?, ?)
       ON CONFLICT (organization_id, dedupe_key) DO NOTHING`,
      [orgId, leadId, key, reason],
    );
    run(
      `UPDATE prospecting_leads SET status = 'nao_contatar', updated_at = datetime('now')
       WHERE id = ? AND organization_id = ?`,
      [leadId, orgId],
    );
  });
  logActivity(orgId, 'lead_suppressed', 'lead', leadId, `${lead.name}: ${reason}`);
}

// ── Log de atividades ────────────────────────────────────────────────────────

export function logActivity(
  orgId: number,
  action: string,
  entity: string | null,
  entityId: number | null,
  detail: string | null,
): void {
  run(
    `INSERT INTO prospecting_activity_log (organization_id, action, entity, entity_id, detail)
     VALUES (?, ?, ?, ?, ?)`,
    [orgId, action, entity, entityId, detail],
  );
}

export function listActivity(orgId: number, limit = 50): ActivityEntry[] {
  return all<ActivityEntry>(
    'SELECT * FROM prospecting_activity_log WHERE organization_id = ? ORDER BY created_at DESC LIMIT ?',
    [orgId, limit],
  );
}

// ── Estatísticas ─────────────────────────────────────────────────────────────

export function getStats(orgId: number): Record<string, number> {
  const byStatus = all<{ status: string; n: number }>(
    'SELECT status, COUNT(*) as n FROM prospecting_leads WHERE organization_id = ? AND is_demo = 0 GROUP BY status',
    [orgId],
  );
  const byPriority = all<{ priority: string; n: number }>(
    'SELECT priority, COUNT(*) as n FROM prospecting_leads WHERE organization_id = ? AND is_demo = 0 GROUP BY priority',
    [orgId],
  );
  const messagesSent = get<{ n: number }>(
    'SELECT COUNT(*) as n FROM prospecting_messages WHERE organization_id = ? AND status = \'enviada\'',
    [orgId],
  );
  const messagesPending = get<{ n: number }>(
    'SELECT COUNT(*) as n FROM prospecting_messages WHERE organization_id = ? AND status = \'pendente\'',
    [orgId],
  );
  const totalLeads = get<{ n: number }>(
    'SELECT COUNT(*) as n FROM prospecting_leads WHERE organization_id = ? AND is_demo = 0',
    [orgId],
  );

  const stats: Record<string, number> = {
    totalLeads: totalLeads?.n ?? 0,
    messagesSent: messagesSent?.n ?? 0,
    messagesPending: messagesPending?.n ?? 0,
  };
  for (const r of byStatus) stats[`status_${r.status}`] = r.n;
  for (const r of byPriority) stats[`priority_${r.priority}`] = r.n;
  return stats;
}
