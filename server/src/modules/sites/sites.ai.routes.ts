import { Router } from 'express';
import { get, run } from '../../db/index.js';
import { badRequest, notFound } from '../../utils/errors.js';
import { logger } from '../../utils/logger.js';
import { requireAuth } from '../auth/auth.middleware.js';
import {
  HTML_SYSTEM_PROMPT,
  extractHtml,
  isClaudeConfigured,
  streamClaude,
  type ClaudeMessage,
} from './claude.service.js';

/**
 * Geração e edição de sites em HTML completo via chat (estilo Lovable).
 * O HTML fica no mesmo envelope JSON do projeto (content_json), no campo "html",
 * então não precisa de migration. Montado antes do sitesRouter em server.ts.
 */
export const sitesAiRouter = Router();

const MAX_HISTORY = 10;
const generating = new Set<string>();

interface Row {
  id: number;
  name: string;
  content_json: string | null;
}

interface Envelope {
  brief?: unknown;
  content?: unknown;
  html?: string;
  htmlHistory?: string[];
  [key: string]: unknown;
}

function load(org: number, id: number) {
  const row = get<Row>(
    'SELECT id, name, content_json FROM site_projects WHERE id = ? AND organization_id = ?',
    [id, org],
  );
  if (!row) return null;
  let env: Envelope = {};
  try {
    env = row.content_json ? (JSON.parse(row.content_json) as Envelope) : {};
  } catch {
    env = {};
  }
  // formato antigo: conteúdo direto, sem envelope
  if (env.content === undefined && typeof env.layout === 'string') env = { content: env };
  return { row, env };
}

function save(org: number, id: number, env: Envelope) {
  run(
    `UPDATE site_projects SET content_json = ?, updated_at = datetime('now')
     WHERE id = ? AND organization_id = ?`,
    [JSON.stringify(env), id, org],
  );
}

function publicState(env: Envelope) {
  return {
    html: env.html ?? null,
    canUndo: (env.htmlHistory?.length ?? 0) > 0,
    aiConfigured: isClaudeConfigured(),
  };
}

function briefText(env: Envelope, name: string): string {
  const b = (env.brief ?? {}) as Record<string, unknown>;
  const labels: [string, string][] = [
    ['segment', 'Segmento'],
    ['description', 'Descrição'],
    ['targetAudience', 'Público-alvo'],
    ['services', 'Serviços/produtos'],
    ['phone', 'Telefone'],
    ['whatsapp', 'WhatsApp'],
    ['email', 'E-mail'],
    ['address', 'Endereço'],
    ['instagram', 'Instagram'],
    ['goal', 'Objetivo'],
    ['style', 'Estilo'],
  ];
  const lines = [`Nome do negócio: ${name}`];
  for (const [key, label] of labels) {
    const v = b[key];
    if (typeof v === 'string' && v.trim()) lines.push(`${label}: ${v.trim()}`);
  }
  return lines.join('\n');
}

// GET /api/sites/:id/html — HTML atual do projeto
sitesAiRouter.get('/:id/html', requireAuth, (req, res, next) => {
  try {
    const found = load(req.auth!.org, Number(req.params.id));
    if (!found) throw notFound('Projeto não encontrado.');
    res.json(publicState(found.env));
  } catch (err) {
    next(err);
  }
});

// POST /api/sites/:id/html/undo — volta para a versão anterior
sitesAiRouter.post('/:id/html/undo', requireAuth, (req, res, next) => {
  try {
    const org = req.auth!.org;
    const id = Number(req.params.id);
    const found = load(org, id);
    if (!found) throw notFound('Projeto não encontrado.');
    const history = found.env.htmlHistory ?? [];
    const previous = history.pop();
    if (previous === undefined) throw badRequest('Não há versão anterior.');
    found.env.html = previous;
    found.env.htmlHistory = history;
    save(org, id, found.env);
    res.json(publicState(found.env));
  } catch (err) {
    next(err);
  }
});

// POST /api/sites/:id/html/stream — gera (ou edita) o site e transmite via SSE
sitesAiRouter.post('/:id/html/stream', requireAuth, async (req, res, next) => {
  try {
    const org = req.auth!.org;
    const id = Number(req.params.id);
    const body = (req.body ?? {}) as { prompt?: unknown };
    const prompt = typeof body.prompt === 'string' ? body.prompt.trim() : '';
    if (prompt.length < 3) throw badRequest('Descreva o que você quer.');
    if (prompt.length > 4000) throw badRequest('Pedido muito longo (máximo de 4000 caracteres).');

    if (!isClaudeConfigured()) {
      res.status(503).json({ error: 'IA não configurada. Defina ANTHROPIC_API_KEY no servidor.' });
      return;
    }

    const found = load(org, id);
    if (!found) throw notFound('Projeto não encontrado.');

    const lockKey = `${org}:${id}`;
    if (generating.has(lockKey)) {
      res.status(409).json({ error: 'Já existe uma geração em andamento neste projeto.' });
      return;
    }
    generating.add(lockKey);

    const currentHtml = found.env.html;
    const messages: ClaudeMessage[] = [
      {
        role: 'user',
        content: currentHtml
          ? `HTML atual do site:\n\n${currentHtml}\n\nInstrução de alteração: ${prompt}`
          : `${briefText(found.env, found.row.name)}\n\nPedido: ${prompt}`,
      },
    ];

    res.writeHead(200, {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    });

    const controller = new AbortController();
    res.on('close', () => {
      if (!res.writableEnded) controller.abort();
    });
    const send = (payload: unknown) => {
      if (!res.writableEnded) res.write(`data: ${JSON.stringify(payload)}\n\n`);
    };

    try {
      const full = await streamClaude({
        system: HTML_SYSTEM_PROMPT,
        messages,
        signal: controller.signal,
        onText: (text) => send({ type: 'delta', text }),
      });

      const html = extractHtml(full);
      if (!html) {
        send({
          type: 'error',
          message: 'A IA não devolveu um site completo (resposta cortada). Tente de novo com um pedido mais simples.',
        });
      } else {
        // recarrega para não sobrescrever edições salvas durante a geração
        const fresh = load(org, id);
        if (fresh) {
          const history = fresh.env.htmlHistory ?? [];
          if (fresh.env.html) history.push(fresh.env.html);
          fresh.env.htmlHistory = history.slice(-MAX_HISTORY);
          fresh.env.html = html;
          save(org, id, fresh.env);
        }
        send({ type: 'done', html });
      }
    } catch (err) {
      if (!controller.signal.aborted) {
        logger.error('Falha ao gerar site com Claude', {
          message: err instanceof Error ? err.message : String(err),
        });
        send({ type: 'error', message: 'Falha ao falar com a IA. Tente novamente.' });
      }
    } finally {
      generating.delete(lockKey);
      res.end();
    }
  } catch (err) {
    next(err);
  }
});
