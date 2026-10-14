import { Router } from 'express';
import { loginSchema, registerSchema } from './auth.schemas.js';
import { login, register } from './auth.service.js';
import { rateLimit, requireAuth } from './auth.middleware.js';
import { badRequest, unauthorized } from '../../utils/errors.js';
import { get as dbGet } from '../../db/index.js';

export const authRouter = Router();

// Limite anti-força-bruta: 5 registros e 10 logins por minuto por IP
// Em ambiente de teste o limite é mais alto para não bloquear a suíte
const regLimit = process.env.NODE_ENV === 'test' ? 1000 : 5;
const loginLimit = process.env.NODE_ENV === 'test' ? 1000 : 10;

authRouter.post('/register', rateLimit(regLimit, 60_000), async (req, res, next) => {
  try {
    const parsed = registerSchema.safeParse(req.body);
    if (!parsed.success) {
      throw badRequest('Dados inválidos.', parsed.error.flatten());
    }
    res.status(201).json(await register(parsed.data));
  } catch (err) {
    next(err);
  }
});

authRouter.post('/login', rateLimit(loginLimit, 60_000), async (req, res, next) => {
  try {
    const parsed = loginSchema.safeParse(req.body);
    if (!parsed.success) {
      throw badRequest('Dados inválidos.', parsed.error.flatten());
    }
    res.json(await login(parsed.data));
  } catch (err) {
    next(err);
  }
});

// GET /api/auth/me — dados do usuário autenticado
authRouter.get('/me', requireAuth, (req, res, next) => {
  try {
    const user = dbGet<{
      id: number;
      name: string;
      email: string;
      role: string;
      organization_id: number;
    }>('SELECT id, name, email, role, organization_id FROM users WHERE id = ?', [req.auth!.sub]);

    if (!user) throw unauthorized();
    res.json({
      id: user.id,
      organizationId: user.organization_id,
      name: user.name,
      email: user.email,
      role: user.role,
    });
  } catch (err) {
    next(err);
  }
});
