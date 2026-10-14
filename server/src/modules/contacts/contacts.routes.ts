import { Router } from 'express';
import { all, get, run, transaction } from '../../db/index.js';
import { badRequest, conflict, notFound, normalizePhone } from '../../utils/errors.js';
import { requireAdmin, requireAuth } from '../auth/auth.middleware.js';

export const contactsRouter = Router();
contactsRouter.use(requireAuth);

// ── Tipos ──────────────────────────────────────────────────────────────────

interface ContactRow {
  id: number;
  organization_id: number;
  name: string;
  phone: string | null;
  whatsapp: string | null;
  email: string | null;
  company: string | null;
  source: string | null;
  interest: string | null;
  stage: string;
  next_action: string | null;
  notes: string | null;
  consent: number;
  opt_out: number;
  last_contact_at: string | null;
  created_at: string;
  updated_at: string;
  tags: string[];
}

const SELECT_WITH_TAGS = `SELECT c.*, COALESCE(
         (SELECT group_concat(t.name) FROM contact_tags ct
          JOIN tags t ON t.id = ct.tag_id
          WHERE ct.contact_id = c.id), ''
       ) AS tags_csv
       FROM contacts c`;

// ── Listagem com busca e filtros ───────────────────────────────────────────

contactsRouter.get('/', (req, res, next) => {
  try {
    const org = req.auth!.org;
    const q = typeof req.query.q === 'string' ? req.query.q.trim() : '';
    const stage = typeof req.query.stage === 'string' ? req.query.stage : '';
    const source = typeof req.query.source === 'string' ? req.query.source : '';
    const tag = typeof req.query.tag === 'string' ? req.query.tag.trim() : '';

    const where: string[] = ['c.organization_id = ?'];
    const params: unknown[] = [org];

    if (q) {
      where.push('(c.name LIKE ? OR c.phone LIKE ? OR c.email LIKE ?)');
      const like = `%${q}%`;
      params.push(like, like, like);
    }
    if (stage) {
      where.push('c.stage = ?');
      params.push(stage);
    }
    if (source) {
      where.push('c.source = ?');
      params.push(source);
    }
    if (tag) {
      where.push(
        `EXISTS (SELECT 1 FROM contact_tags ct
                 JOIN tags t ON t.id = ct.tag_id
                 WHERE ct.contact_id = c.id AND t.name = ?)`,
      );
      params.push(tag);
    }

    const rows = all<ContactRow & { tags_csv: string }>(
      `${SELECT_WITH_TAGS}
       WHERE ${where.join(' AND ')}
       ORDER BY c.created_at DESC, c.id DESC`,
      params,
    );

    const data = rows.map(withTags);
    res.json({ data, total: data.length });
  } catch (err) {
    next(err);
  }
});

// ── Criação ────────────────────────────────────────────────────────────────

contactsRouter.post('/', (req, res, next) => {
  try {
    const org = req.auth!.org;
    const body = (req.body ?? {}) as Record<string, unknown>;

    const name = typeof body.name === 'string' ? body.name.trim() : '';
    if (name.length < 2) throw badRequest('Informe o nome do contato (mínimo 2 caracteres).');

    const email =
      typeof body.email === 'string' && body.email.trim()
        ? body.email.trim().toLowerCase()
        : null;
    if (email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) throw badRequest('E-mail inválido.');

    const rawPhone =
      typeof body.phone === 'string' && body.phone.trim() ? body.phone.trim() : null;
    const phone = rawPhone ? normalizePhone(rawPhone) : null;
    if (rawPhone && !phone) throw badRequest('Telefone inválido. Use DDD + número (8 ou 9 dígitos).');

    if (email) {
      const dup = get<{ id: number }>(
        'SELECT id FROM contacts WHERE organization_id = ? AND email = ?',
        [org, email],
      );
      if (dup) throw conflict(`Já existe um contato com o e-mail ${email} (id ${dup.id}).`);
    }
    if (phone) {
      const dup = get<{ id: number }>(
        'SELECT id FROM contacts WHERE organization_id = ? AND phone = ?',
        [org, phone],
      );
      if (dup) throw conflict(`Já existe um contato com o telefone ${phone} (id ${dup.id}).`);
    }

    const tags = tagList(body.tags);
    const whatsapp = str(body.whatsapp) ?? phone;

    const id = transaction(() => {
      const r = run(
        `INSERT INTO contacts
           (organization_id, name, phone, whatsapp, email, company, source, interest,
            stage, next_action, notes, consent, opt_out)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          org,
          name,
          phone,
          whatsapp,
          email,
          str(body.company),
          str(body.source),
          str(body.interest),
          str(body.stage) ?? 'new_lead',
          str(body.next_action),
          str(body.notes),
          body.consent === true ? 1 : 0,
          body.opt_out === true ? 1 : 0,
        ],
      );
      const contactId = Number(r.lastInsertRowid);
      setTags(org, contactId, tags);
      return contactId;
    });

    res.status(201).json(findContact(id)!);
  } catch (err) {
    next(err);
  }
});

// ── Atualização ────────────────────────────────────────────────────────────

contactsRouter.put('/:id', (req, res, next) => {
  try {
    const org = req.auth!.org;
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) throw badRequest('ID inválido.');

    const current = findContact(id);
    if (!current || current.organization_id !== org) throw notFound('Contato não encontrado.');

    const body = (req.body ?? {}) as Record<string, unknown>;
    const email =
      typeof body.email === 'string' && body.email.trim()
        ? body.email.trim().toLowerCase()
        : current.email;

    const rawPhone =
      typeof body.phone === 'string' && body.phone.trim() ? body.phone.trim() : current.phone;
    const phone = rawPhone ? normalizePhone(rawPhone) : null;
    if (rawPhone && !phone) throw badRequest('Telefone inválido. Use DDD + número (8 ou 9 dígitos).');

    if (email) {
      const dup = get<{ id: number }>(
        'SELECT id FROM contacts WHERE organization_id = ? AND email = ? AND id <> ?',
        [org, email, id],
      );
      if (dup) throw conflict(`Já existe outro contato com o e-mail ${email}.`);
    }

    const tags = Array.isArray(body.tags) ? tagList(body.tags) : current.tags;

    transaction(() => {
      run(
        `UPDATE contacts SET
           name = ?, phone = ?, whatsapp = ?, email = ?, company = ?, source = ?,
           interest = ?, stage = ?, next_action = ?, notes = ?, consent = ?, opt_out = ?,
           updated_at = datetime('now')
         WHERE id = ? AND organization_id = ?`,
        [
          str(body.name) ?? current.name,
          phone,
          str(body.whatsapp) ?? phone,
          email,
          str(body.company) ?? current.company,
          str(body.source) ?? current.source,
          str(body.interest) ?? current.interest,
          str(body.stage) ?? current.stage,
          str(body.next_action) ?? current.next_action,
          str(body.notes) ?? current.notes,
          body.consent === true ? 1 : body.consent === false ? 0 : current.consent,
          body.opt_out === true ? 1 : body.opt_out === false ? 0 : current.opt_out,
          id,
          org,
        ],
      );
      setTags(org, id, tags);
    });

    res.json(findContact(id));
  } catch (err) {
    next(err);
  }
});

// ── Exclusão (apenas admin) ────────────────────────────────────────────────

contactsRouter.delete('/:id', requireAdmin, (req, res, next) => {
  try {
    const org = req.auth!.org;
    const id = Number(req.params.id);
    const r = run('DELETE FROM contacts WHERE id = ? AND organization_id = ?', [id, org]);
    if (r.changes === 0) throw notFound('Contato não encontrado.');
    res.json({ ok: true, removed: id });
  } catch (err) {
    next(err);
  }
});

// ── Seleção de destinatários ───────────────────────────────────────────────

// POST /api/contacts/select — body: { ids: number[] }
// Devolve os contatos válidos para recebimento (consentimento, sem opt-out,
// com telefone ou e-mail) e separa os bloqueados com o motivo. Nada é enviado
// automaticamente — o dono da base decide os destinatários (doc, seções 7 e 9).
contactsRouter.post('/select', (req, res, next) => {
  try {
    const org = req.auth!.org;
    const raw = (req.body as { ids?: unknown } | undefined)?.ids;
    const ids = Array.isArray(raw)
      ? raw.filter((v): v is number => typeof v === 'number' && Number.isInteger(v) && v > 0)
      : [];
    if (ids.length === 0) throw badRequest('Selecione ao menos um contato.');

    const placeholders = ids.map(() => '?').join(',');
    const rows = all<ContactRow & { tags_csv: string }>(
      `${SELECT_WITH_TAGS} WHERE c.organization_id = ? AND c.id IN (${placeholders})`,
      [org, ...ids],
    );

    const eligible: ContactRow[] = [];
    const blocked: { id: number; name: string; reason: string }[] = [];
    for (const c of rows) {
      if (c.opt_out === 1) {
        blocked.push({ id: c.id, name: c.name, reason: 'Solicitou não receber mensagens (opt-out).' });
      } else if (c.consent !== 1) {
        blocked.push({ id: c.id, name: c.name, reason: 'Sem consentimento registrado para comunicações.' });
      } else if (!c.phone && !c.email) {
        blocked.push({ id: c.id, name: c.name, reason: 'Sem telefone ou e-mail válido.' });
      } else {
        eligible.push(withTags(c));
      }
    }

    res.json({
      eligible,
      blocked,
      totalEligible: eligible.length,
      totalBlocked: blocked.length,
    });
  } catch (err) {
    next(err);
  }
});

// ── Etiquetas ──────────────────────────────────────────────────────────────

contactsRouter.get('/tags/all', (req, res, next) => {
  try {
    const rows = all<{ id: number; name: string }>(
      'SELECT id, name FROM tags WHERE organization_id = ? ORDER BY name',
      [req.auth!.org],
    );
    res.json({ data: rows });
  } catch (err) {
    next(err);
  }
});

// ── Helpers ────────────────────────────────────────────────────────────────

function str(v: unknown): string | null {
  return typeof v === 'string' && v.trim() !== '' ? v.trim() : null;
}

function tagList(v: unknown): string[] {
  if (!Array.isArray(v)) return [];
  return v
    .filter((t): t is string => typeof t === 'string' && t.trim() !== '')
    .map((t) => t.trim());
}

/** Separa o tags_csv do resto da linha e devolve tags como array. */
function withTags(row: ContactRow & { tags_csv: string }): ContactRow {
  const { tags_csv, ...rest } = row;
  return { ...rest, tags: tags_csv ? tags_csv.split(',') : [] };
}

function findContact(id: number): ContactRow | undefined {
  const row = get<ContactRow & { tags_csv: string }>(`${SELECT_WITH_TAGS} WHERE c.id = ?`, [id]);
  return row ? withTags(row) : undefined;
}

function setTags(org: number, contactId: number, tagNames: string[]): void {
  run('DELETE FROM contact_tags WHERE contact_id = ?', [contactId]);
  for (const name of tagNames) {
    let tag = get<{ id: number }>(
      'SELECT id FROM tags WHERE organization_id = ? AND name = ?',
      [org, name],
    );
    if (!tag) {
      const r = run('INSERT INTO tags (organization_id, name) VALUES (?, ?)', [org, name]);
      tag = { id: Number(r.lastInsertRowid) };
    }
    run('INSERT OR IGNORE INTO contact_tags (contact_id, tag_id) VALUES (?, ?)', [
      contactId,
      tag.id,
    ]);
  }
}
