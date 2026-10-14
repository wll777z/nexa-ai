import { get, run, transaction } from '../../db/index.js';
import { badRequest, conflict } from '../../utils/errors.js';
import { hashPassword, verifyPassword } from './auth.password.js';
import { signToken } from './auth.jwt.js';
import type { RegisterInput, LoginInput } from './auth.schemas.js';

export interface AuthUser {
  id: number;
  organizationId: number;
  name: string;
  email: string;
  role: string;
}

export interface AuthResult {
  token: string;
  user: AuthUser;
}

/** Registra um novo usuário + organização (transação atômica). */
export async function register(input: RegisterInput): Promise<AuthResult> {
  const existing = get<{ id: number }>('SELECT id FROM users WHERE email = ?', [input.email]);
  if (existing) throw conflict('Este e-mail já está cadastrado.');

  const passwordHash = await hashPassword(input.password);

  const result = transaction(() => {
    const org = run('INSERT INTO organizations (name) VALUES (?)', [input.organizationName]);
    const organizationId = Number(org.lastInsertRowid);
    const user = run(
      `INSERT INTO users (organization_id, name, email, password_hash, role)
       VALUES (?, ?, ?, ?, 'owner')`,
      [organizationId, input.name, input.email, passwordHash],
    );
    return { organizationId, userId: Number(user.lastInsertRowid) };
  });

  const user = get<{ id: number; name: string; email: string; role: string }>(
    'SELECT id, name, email, role FROM users WHERE id = ?',
    [result.userId],
  );
  if (!user) throw new Error('Falha inesperada ao criar usuário.');

  const token = signToken({ sub: user.id, org: result.organizationId, role: user.role });
  return {
    token,
    user: {
      id: user.id,
      organizationId: result.organizationId,
      name: user.name,
      email: user.email,
      role: user.role,
    },
  };
}

/** Autentica por e-mail + senha. */
export async function login(input: LoginInput): Promise<AuthResult> {
  const row = get<{
    id: number;
    organization_id: number;
    name: string;
    email: string;
    role: string;
    password_hash: string;
  }>('SELECT * FROM users WHERE email = ?', [input.email]);

  if (!row) throw badRequest('E-mail ou senha incorretos.');
  if (!(await verifyPassword(input.password, row.password_hash))) {
    throw badRequest('E-mail ou senha incorretos.');
  }

  const token = signToken({ sub: row.id, org: row.organization_id, role: row.role });
  return {
    token,
    user: {
      id: row.id,
      organizationId: row.organization_id,
      name: row.name,
      email: row.email,
      role: row.role,
    },
  };
}
