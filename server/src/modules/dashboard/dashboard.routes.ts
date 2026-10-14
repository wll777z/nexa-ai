import { Router } from 'express';
import { all, get } from '../../db/index.js';
import { requireAuth } from '../auth/auth.middleware.js';

export const dashboardRouter = Router();
dashboardRouter.use(requireAuth);

/**
 * GET /api/dashboard/overview
 * Retorna métricas REAIS do banco da organização do usuário. Nada aqui é
 * simulado ou estimado (doc, seção 4). Campos sem dado ficam em 0.
 */
dashboardRouter.get('/overview', (req, res, next) => {
  try {
    const org = req.auth!.org;

    const contacts = get<{ n: number }>(
      'SELECT COUNT(*) AS n FROM contacts WHERE organization_id = ?',
      [org],
    )!;
    const newLeads = get<{ n: number }>(
      "SELECT COUNT(*) AS n FROM contacts WHERE organization_id = ? AND stage = 'new_lead'",
      [org],
    )!;
    const converted = get<{ n: number }>(
      "SELECT COUNT(*) AS n FROM contacts WHERE organization_id = ? AND stage = 'converted'",
      [org],
    )!;
    const optOut = get<{ n: number }>(
      "SELECT COUNT(*) AS n FROM contacts WHERE organization_id = ? AND opt_out = 1",
      [org],
    )!;
    const noConsent = get<{ n: number }>(
      "SELECT COUNT(*) AS n FROM contacts WHERE organization_id = ? AND consent = 0",
      [org],
    )!;

    const byStage = all<{ stage: string; n: number }>(
      'SELECT stage, COUNT(*) AS n FROM contacts WHERE organization_id = ? GROUP BY stage',
      [org],
    );

    const bySource = all<{ source: string | null; n: number }>(
      `SELECT source, COUNT(*) AS n FROM contacts WHERE organization_id = ?
       GROUP BY source ORDER BY n DESC`,
      [org],
    );

    const recent = all<{
      id: number;
      name: string;
      source: string | null;
      stage: string;
      created_at: string;
    }>(
      `SELECT id, name, source, stage, created_at FROM contacts
       WHERE organization_id = ? ORDER BY created_at DESC, id DESC LIMIT 8`,
      [org],
    );

    res.json({
      totals: {
        contacts: contacts.n,
        newLeads: newLeads.n,
        converted: converted.n,
        optOut: optOut.n,
        noConsent: noConsent.n,
      },
      byStage,
      bySource: bySource.map((r) => ({ source: r.source ?? 'Não informada', n: r.n })),
      recentContacts: recent,
      // Campos de módulos ainda não implementados: zerados de propósito,
      // preenchidos por dados reais nas próximas fases.
      pendingAttention: noConsent.n,
    });
  } catch (err) {
    next(err);
  }
});
