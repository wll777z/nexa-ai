import type { Request } from 'express';

export class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
    public details?: unknown,
  ) {
    super(message);
    this.name = 'HttpError';
  }
}

export const badRequest = (msg: string, details?: unknown) => new HttpError(400, msg, details);
export const unauthorized = (msg = 'Credenciais inválidas ou sessão expirada.') => new HttpError(401, msg);
export const forbidden = (msg = 'Você não tem permissão para esta ação.') => new HttpError(403, msg);
export const notFound = (msg = 'Registro não encontrado.') => new HttpError(404, msg);
export const conflict = (msg: string) => new HttpError(409, msg);

/** Normaliza telefone: remove máscara, garante prefixo 55 do Brasil. */
export function normalizePhone(raw: string): string | null {
  const digits = raw.replace(/\D/g, '');
  if (digits.length === 0) return null;
  const withCountry = digits.startsWith('55') ? digits : `55${digits}`;
  // DDI(2) + DDD(2) + número(8 ou 9) = 12 ou 13 dígitos
  if (withCountry.length < 12 || withCountry.length > 13) return null;
  return withCountry;
}

export function clientIp(req: Request): string {
  return (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() || req.ip || 'desconhecido';
}
