import jwt, { type SignOptions } from 'jsonwebtoken';
import { env } from '../../config/env.js';
import { unauthorized } from '../../utils/errors.js';

export interface TokenPayload {
  sub: number;        // id do usuário
  org: number;        // id da organização
  role: string;       // papel do usuário
}

export function signToken(payload: TokenPayload): string {
  const options: SignOptions = { expiresIn: env.JWT_EXPIRES_IN as SignOptions['expiresIn'] };
  return jwt.sign(payload, env.JWT_SECRET, options);
}

export function verifyToken(token: string): TokenPayload {
  try {
    const decoded = jwt.verify(token, env.JWT_SECRET) as unknown as TokenPayload;
    if (typeof decoded === 'string') throw unauthorized();
    return decoded;
  } catch {
    throw unauthorized();
  }
}
