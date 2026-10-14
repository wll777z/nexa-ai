import { Router } from 'express';
import { all, get, run, transaction } from '../../db/index.js';
import { badRequest, notFound } from '../../utils/errors.js';
import { requireAuth } from '../auth/auth.middleware.js';
import { generateSite, isAIConfigured } from './ai.service.js';
import type { SiteBrief, SiteContent } from './site.model.js';

export const sitesRouter = Router();
sitesRouter.use(requireAuth);

// GET /api/sites/ai-status — diz se a IA externa está configurada (sem expor a chave)
sitesRouter.get('/ai-status', (_req, res) => {
  res.json({ configured: isAIConfigured() });
});

// GET /api/sites — lista projetos da organização
sitesRouter.get('/', (req, res, next) => {
  try {
    const rows = all<SiteProject>(
      'SELECT * FROM site_projects WHERE organization_id = ? ORDER BY updated_at DESC',
      [req.auth!.org],
    );
    res.json({ data: rows.map(parse), total: rows.length });
  } catch (err) {
    next(err);
  }
});

// POST /api/sites — cria projeto a partir do briefing (IA ou gerador local)
sitesRouter.post('/', async (req, res, next) => {
  try {
    const org = req.auth!.org;
    const uid = req.auth!.sub;
    const body = (req.body ?? {}) as Record<string, unknown>;

    const brief = parseBrief(body);
    if (brief.companyName.length < 2) {
      throw badRequest('Informe o nome da empresa/projeto.');
    }

    // Sempre gera conteúdo real: via IA externa (se configurada) ou gerador
    // local. O campo source diz ao frontend de onde veio — nada é fingido.
    const { content, source } = await generateSite(brief);
    const envelope = JSON.stringify({ brief, content });

    const id = transaction(() => {
      const r = run(
        `INSERT INTO site_projects (organization_id, user_id, name, brief, content_json, status)
         VALUES (?, ?, ?, ?, ?, 'draft')`,
        [org, uid, brief.companyName, brief.description ?? '', envelope],
      );
      return Number(r.lastInsertRowid);
    });

    const created = get<SiteProject>('SELECT * FROM site_projects WHERE id = ?', [id])!;
    res.status(201).json({ ...parse(created), source });
  } catch (err) {
    next(err);
  }
});

// GET /api/sites/:id — um projeto
sitesRouter.get('/:id', (req, res, next) => {
  try {
    const p = findOwned(req.auth!.org, Number(req.params.id));
    if (!p) throw notFound('Projeto não encontrado.');
    res.json(parse(p));
  } catch (err) {
    next(err);
  }
});

// PUT /api/sites/:id — salva rascunho/edição (persiste o envelope {brief, content})
sitesRouter.put('/:id', (req, res, next) => {
  try {
    const org = req.auth!.org;
    const id = Number(req.params.id);
    const current = findOwned(org, id);
    if (!current) throw notFound('Projeto não encontrado.');

    const body = (req.body ?? {}) as Record<string, unknown>;
    const name = typeof body.name === 'string' && body.name.trim() ? body.name.trim() : current.name;
    const content = body.content;
    if (content !== undefined && (typeof content !== 'object' || content === null)) {
      throw badRequest('Conteúdo inválido.');
    }
    const brief = body.brief;

    // recupera o envelope atual para mesclar
    let env: Envelope = {};
    try {
      env = current.content_json ? (JSON.parse(current.content_json) as Envelope) : {};
    } catch {
      env = {};
    }
    if (content !== undefined) env.content = content as SiteContent;
    if (brief !== undefined && typeof brief === 'object' && brief !== null) {
      env.brief = brief as SiteBrief;
    }

    const status = typeof body.status === 'string' ? body.status : current.status;
    const validStatus = ['draft', 'ready', 'publishing', 'published'].includes(status)
      ? status
      : current.status;

    run(
      `UPDATE site_projects
       SET name = ?, content_json = ?, status = ?, updated_at = datetime('now')
       WHERE id = ? AND organization_id = ?`,
      [name, JSON.stringify(env), validStatus, id, org],
    );
    res.json(parse(findOwned(org, id)!));
  } catch (err) {
    next(err);
  }
});

// POST /api/sites/:id/duplicate — duplica um projeto existente
sitesRouter.post('/:id/duplicate', (req, res, next) => {
  try {
    const org = req.auth!.org;
    const uid = req.auth!.sub;
    const src = findOwned(org, Number(req.params.id));
    if (!src) throw notFound('Projeto não encontrado.');

    const id = transaction(() => {
      const r = run(
        `INSERT INTO site_projects (organization_id, user_id, name, brief, content_json, status)
         VALUES (?, ?, ?, ?, ?, 'draft')`,
        [org, uid, `${src.name} (cópia)`, src.brief, src.content_json],
      );
      return Number(r.lastInsertRowid);
    });
    res.status(201).json(parse(findOwned(org, id)!));
  } catch (err) {
    next(err);
  }
});

// DELETE /api/sites/:id
sitesRouter.delete('/:id', (req, res, next) => {
  try {
    const r = run('DELETE FROM site_projects WHERE id = ? AND organization_id = ?', [
      Number(req.params.id),
      req.auth!.org,
    ]);
    if (r.changes === 0) throw notFound('Projeto não encontrado.');
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

// ── Tipos e helpers ─────────────────────────────────────────────────────

interface SiteProject {
  id: number;
  organization_id: number;
  user_id: number;
  name: string;
  brief: string | null;
  content_json: string | null;
  status: string;
  created_at: string;
  updated_at: string;
}

function findOwned(org: number, id: number): SiteProject | undefined {
  return get<SiteProject>(
    'SELECT * FROM site_projects WHERE id = ? AND organization_id = ?',
    [id, org],
  );
}

interface Envelope {
  brief?: SiteBrief;
  content?: SiteContent;
}

/** Lê o envelope {brief, content} — com tolerância a dados antigos. */
function parse(row: SiteProject) {
  let brief: SiteBrief | null = null;
  let content: SiteContent | null = null;
  try {
    if (row.content_json) {
      const env = JSON.parse(row.content_json) as Envelope;
      if (env.content) {
        // formato novo (envelope)
        content = env.content;
        brief = env.brief ?? null;
      } else {
        // formato antigo (conteúdo direto) — mantém compatibilidade
        content = env as unknown as SiteContent;
      }
    }
  } catch {
    content = null;
  }
  const { content_json, ...rest } = row;
  return { ...rest, brief, content };
}

function parseBrief(body: Record<string, unknown>): SiteBrief {
  const s = (v: unknown) => (typeof v === 'string' ? v.trim() : '');
  return {
    companyName: s(body.companyName) || s(body.name),
    segment: s(body.segment) || undefined,
    description: s(body.description) || s(body.brief) || undefined,
    targetAudience: s(body.targetAudience) || undefined,
    services: s(body.services) || undefined,
    phone: s(body.phone) || undefined,
    whatsapp: s(body.whatsapp) || undefined,
    email: s(body.email) || undefined,
    address: s(body.address) || undefined,
    instagram: s(body.instagram) || undefined,
    goal: s(body.goal) || undefined,
    style: s(body.style) || undefined,
  };
}
