import { Router } from 'express';
import { run } from '../../db/index.js';
import { requireAuth } from '../auth/auth.middleware.js';
import { badRequest, notFound } from '../../utils/errors.js';
import {
  searchCompanies,
  saveLeads,
  listLeads,
  getConfig,
  saveConfig,
  createMessageForLead,
  approveMessage,
  rejectMessage,
  listMessages,
  suppressLead,
  listActivity,
  getStats,
  isGoogleMapsConfigured,
  logActivity,
} from './prospecting.service.js';
import { isAIConfigured } from './prospecting.ai.js';
import { ALL_STATUSES, type LeadStatus, type LeadPriority } from './prospecting.model.js';
import { addCompany, confirmCsv, previewCsv, validateCompany } from './opportunities.js';
import { z } from 'zod';

export const prospectingRouter = Router();
prospectingRouter.use(requireAuth);

const importSchema = z.object({ csv: z.string().min(1).max(256_000), filename: z.string().trim().min(1).max(160).optional() });
prospectingRouter.post('/leads/manual', (req, res, next) => {
  try {
    const company = validateCompany(req.body);
    const result = addCompany(req.auth!.org, company, 'manual');
    if (result.status === 'created') logActivity(req.auth!.org, 'manual_added', 'lead', result.leadId, company.name);
    res.status(result.status === 'created' ? 201 : 409).json(result);
  } catch (error) { next(error); }
});

prospectingRouter.post('/import/preview', (req, res, next) => {
  try {
    const input = importSchema.parse(req.body);
    res.json({ rows: previewCsv(req.auth!.org, input.csv) });
  } catch (error) { next(error instanceof z.ZodError ? badRequest('Arquivo CSV inválido.') : error); }
});

prospectingRouter.post('/import/confirm', (req, res, next) => {
  try {
    const input = importSchema.parse(req.body);
    const result = confirmCsv(req.auth!.org, req.auth!.sub, input.filename ?? 'import.csv', input.csv);
    logActivity(req.auth!.org, 'csv_imported', 'import', null, `${result.imported} empresas importadas de ${input.filename ?? 'import.csv'}`);
    res.json(result);
  } catch (error) { next(error instanceof z.ZodError ? badRequest('Arquivo CSV inválido.') : error); }
});

// GET /api/prospecting/status — o que está configurado (sem expor chaves)
prospectingRouter.get('/status', (_req, res) => {
  res.json({
    googleMaps: isGoogleMapsConfigured(),
    ai: isAIConfigured(),
    mode: isGoogleMapsConfigured() ? 'google_maps' : 'demo',
  });
});

// GET /api/prospecting/config
prospectingRouter.get('/config', (req, res) => {
  const config = getConfig(req.auth!.org);
  res.json({ config });
});

// PUT /api/prospecting/config
prospectingRouter.put('/config', (req, res, next) => {
  try {
    const body = (req.body ?? {}) as Record<string, unknown>;
    const s = (v: unknown) => (typeof v === 'string' ? v.trim() : '');
    const n = (v: unknown, def: number) => (typeof v === 'number' && v > 0 ? v : def);

    const segments = Array.isArray(body.segments)
      ? (body.segments as unknown[]).filter((x): x is string => typeof x === 'string')
      : [];

    const channel = s(body.channel);
    if (channel && !['manual', 'email', 'whatsapp'].includes(channel)) {
      throw badRequest('Canal inválido. Use: manual, email ou whatsapp.');
    }

    const config = saveConfig(req.auth!.org, {
      service: s(body.service),
      companyName: s(body.companyName),
      description: s(body.description),
      region: s(body.region),
      segments,
      maxPerSearch: n(body.maxPerSearch, 10),
      channel: channel ? (channel as 'manual' | 'email' | 'whatsapp') : undefined,
      messageTemplate: s(body.messageTemplate),
      maxContactsDay: n(body.maxContactsDay, 20),
      autoApprove: body.autoApprove === true,
    });

    logActivity(req.auth!.org, 'config_updated', 'config', config.id, 'Configuração de prospecção atualizada');
    res.json({ config });
  } catch (err) {
    next(err);
  }
});

// POST /api/prospecting/search — inicia uma busca
prospectingRouter.post('/search', async (req, res, next) => {
  try {
    const org = req.auth!.org;
    const config = getConfig(org);
    const body = (req.body ?? {}) as Record<string, unknown>;

    const segments = Array.isArray(body.segments)
      ? (body.segments as unknown[]).filter((x): x is string => typeof x === 'string')
      : (config?.segments ?? []);
    const region = typeof body.region === 'string' && body.region.trim()
      ? body.region.trim()
      : (config?.region ?? '');
    const maxResults = typeof body.maxResults === 'number' && body.maxResults > 0
      ? Math.min(body.maxResults, 50)
      : (config?.maxPerSearch ?? 10);

    if (segments.length === 0) {
      throw badRequest('Informe pelo menos um segmento para pesquisar.');
    }
    if (!region) {
      throw badRequest('Informe a cidade ou região desejada.');
    }

    const companies = await searchCompanies({ segments, region, maxResults });
    const { inserted, skipped } = await saveLeads(org, companies);

    logActivity(
      org,
      'search_completed',
      'search',
      null,
      `Busca: ${segments.join(', ')} em ${region}. ${inserted} novos, ${skipped} duplicados/suprimidos.`,
    );

    res.json({
      found: companies.length,
      inserted,
      skipped,
      isDemo: companies.length > 0 && companies[0].isDemo,
      companies: companies.map((c) => ({
        name: c.name,
        category: c.category,
        city: c.city,
        isDemo: c.isDemo,
      })),
    });
  } catch (err) {
    next(err);
  }
});

// GET /api/prospecting/leads — lista com filtros
prospectingRouter.get('/leads', (req, res) => {
  const org = req.auth!.org;
  const { status, priority, search, includeDemo, city, state, neighborhood, category, source, websiteStatus } = req.query;

  const validStatus = typeof status === 'string' && ALL_STATUSES.includes(status as LeadStatus)
    ? (status as LeadStatus)
    : undefined;
  const validPriority = typeof priority === 'string' && ['alta', 'media', 'baixa'].includes(priority)
    ? (priority as LeadPriority)
    : undefined;

  const leads = listLeads(org, {
    status: validStatus,
    priority: validPriority,
    search: typeof search === 'string' ? search : undefined,
    includeDemo: includeDemo === 'true',
    city: typeof city === 'string' ? city : undefined,
    state: typeof state === 'string' ? state : undefined,
    neighborhood: typeof neighborhood === 'string' ? neighborhood : undefined,
    category: typeof category === 'string' ? category : undefined,
    source: typeof source === 'string' ? source : undefined,
    websiteStatus: websiteStatus === 'provided' || websiteStatus === 'not_provided' ? websiteStatus : undefined,
  });

  res.json({ data: leads, total: leads.length });
});

// GET /api/prospecting/stats
prospectingRouter.get('/stats', (req, res) => {
  res.json({ stats: getStats(req.auth!.org) });
});

// GET /api/prospecting/activity
prospectingRouter.get('/activity', (req, res) => {
  res.json({ data: listActivity(req.auth!.org) });
});

// ── Mensagens ────────────────────────────────────────────────────────────────

// GET /api/prospecting/messages
prospectingRouter.get('/messages', (req, res) => {
  const status = typeof req.query.status === 'string' ? req.query.status : undefined;
  res.json({ data: listMessages(req.auth!.org, status) });
});

// POST /api/prospecting/leads/:id/message — gera mensagem para um lead
prospectingRouter.post('/leads/:id/message', async (req, res, next) => {
  try {
    const result = await createMessageForLead(req.auth!.org, Number(req.params.id));
    res.status(201).json(result);
  } catch (err) {
    next(err);
  }
});

// POST /api/prospecting/messages/:id/approve
prospectingRouter.post('/messages/:id/approve', (req, res, next) => {
  try {
    approveMessage(req.auth!.org, Number(req.params.id), req.auth!.sub);
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

// POST /api/prospecting/messages/:id/reject
prospectingRouter.post('/messages/:id/reject', (req, res, next) => {
  try {
    rejectMessage(req.auth!.org, Number(req.params.id));
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

// POST /api/prospecting/messages/:id/send — envia mensagem aprovada
// ATENÇÃO: só funciona quando um canal real está integrado. Sem integração,
// retorna erro claro explicando que nenhum canal está configurado.
prospectingRouter.post('/messages/:id/send', (req, res, next) => {
  try {
    const org = req.auth!.org;
    const msgId = Number(req.params.id);
    const config = getConfig(org);

    if (!config || config.channel === 'manual') {
      throw badRequest(
        'Nenhum canal de envio configurado. Configure um canal (e-mail ou WhatsApp Business) ' +
        'nas configurações antes de enviar. O sistema opera em modo de aprovação manual.',
      );
    }

    // Quando um canal for implementado (ex: Evolution API, SMTP), a lógica
    // de envio real entra aqui. Por enquanto, retornamos erro claro.
    throw badRequest(
      `Canal "${config.channel}" selecionado, mas a integração ainda não está implementada. ` +
      'Configure as credenciais do canal para ativar o envio automático.',
    );
  } catch (err) {
    next(err);
  }
});

// ── Supressão ────────────────────────────────────────────────────────────────

// POST /api/prospecting/leads/:id/suppress
prospectingRouter.post('/leads/:id/suppress', (req, res, next) => {
  try {
    const body = (req.body ?? {}) as Record<string, unknown>;
    const reason = typeof body.reason === 'string' && body.reason.trim()
      ? body.reason.trim()
      : 'solicitado pelo contato';
    suppressLead(req.auth!.org, Number(req.params.id), reason);
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

// PATCH /api/prospecting/leads/:id/status — atualiza status manualmente
prospectingRouter.patch('/leads/:id/status', (req, res, next) => {
  try {
    const body = (req.body ?? {}) as Record<string, unknown>;
    const status = body.status;
    if (typeof status !== 'string' || !ALL_STATUSES.includes(status as LeadStatus)) {
      throw badRequest(`Status inválido. Use um de: ${ALL_STATUSES.join(', ')}`);
    }
    const r = run(
      `UPDATE prospecting_leads SET status = ?, updated_at = datetime('now')
       WHERE id = ? AND organization_id = ?`,
      [status, Number(req.params.id), req.auth!.org],
    );
    if (r.changes === 0) throw notFound('Lead não encontrado.');
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});
