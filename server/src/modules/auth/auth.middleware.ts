import type { Request } from 'express';
import { env } from '../../config/env.js';
import { HttpError, forbidden } from '../../utils/errors.js';
import { verifyToken, type TokenPayload } from './auth.jwt.js';

// ── Rate limit simples em memória (por IP) ─────────────────────────────────
interface Bucket { count: number; resetAt: number }
const buckets = new Map<string, Bucket>();

export function rateLimit(maxRequests: number, windowMs: number) {
  return (req: Request, _res: unknown, next: (err?: unknown) => void) => {
    const key = req.ip ?? 'global';
    const now = Date.now();
    const bucket = buckets.get(key);
    if (!bucket || bucket.resetAt < now) {
      buckets.set(key, { count: 1, resetAt: now + windowMs });
      next();
      return;
    }
    bucket.count += 1;
    if (bucket.count > maxRequests) {
      next(
        new HttpError(
          429,
          `Muitas requisições. Tente novamente em ${Math.ceil((bucket.resetAt - now) / 1000)}s.`,
        ),
      );
      return;
    }
    next();
  };
}

// Limpeza periódica para a memória não crescer sem limite
setInterval(() => {
  const now = Date.now();
  for (const [key, b] of buckets) {
    if (b.resetAt < now) buckets.delete(key);
  }
}, Math.max(windowMsOf(), 60_000)).unref?.();

function windowMsOf(): number {
  return 60_000;
}

// ── Middleware de autenticação ─────────────────────────────────────────────

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      auth?: TokenPayload;
    }
  }
}

function extractToken(req: Request): string | null {
  const header = req.headers.authorization;
  if (header?.startsWith('Bearer ')) return header.slice(7).trim();
  return null;
}

/** Exige token válido. Popula req.auth. */
export function requireAuth(req: Request, _res: unknown, next: (err?: unknown) => void): void {
  const token = extractToken(req);
  if (!token) {
    next(forbidden('Token de autenticação ausente.'));
    return;
  }
  try {
    req.auth = verifyToken(token);
    next();
  } catch (err) {
    next(err);
  }
}

/** Exige papel de administrador (owner ou admin). */
export function requireAdmin(req: Request, _res: unknown, next: (err?: unknown) => void): void {
  if (!req.auth) {
    next(forbidden());
    return;
  }
  if (req.auth.role !== 'owner' && req.auth.role !== 'admin') {
    next(forbidden('Apenas administradores podem executar esta ação.'));
    return;
  }
  next();
}

export const TOKEN_TTL = env.JWT_EXPIRES_IN;
