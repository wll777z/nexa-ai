import express, { type NextFunction, type Request, type Response } from 'express';
import cors from 'cors';
import { env } from './config/env.js';
import { HttpError } from './utils/errors.js';
import { logger } from './utils/logger.js';
import { migrate } from './db/migrate.js';
import { authRouter } from './modules/auth/auth.routes.js';
import { contactsRouter } from './modules/contacts/contacts.routes.js';
import { dashboardRouter } from './modules/dashboard/dashboard.routes.js';
import { sitesRouter } from './modules/sites/sites.routes.js';

/** Monta a aplicação Express. Separado do listen() para uso nos testes. */
export function createApp() {
  // Aplica migrations pendentes na inicialização
  const { applied } = migrate();
  if (applied.length > 0) logger.info('Migrations aplicadas', { applied });

  const app = express();
  app.disable('x-powered-by');
  app.use(cors({ origin: env.CORS_ORIGIN }));
  app.use(express.json({ limit: '1mb' }));

  // Health check
  app.get('/api/health', (_req, res) => {
    res.json({ status: 'ok', service: 'nexa-ai', env: env.NODE_ENV });
  });

  app.use('/api/auth', authRouter);
  app.use('/api/contacts', contactsRouter);
  app.use('/api/dashboard', dashboardRouter);
  app.use('/api/sites', sitesRouter);

  // Rota não encontrada
  app.use((req, res) => {
    res.status(404).json({ error: 'Rota não encontrada.', path: req.originalUrl });
  });

  // Tratamento de erros central
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
    if (err instanceof HttpError) {
      logger.warn('Erro HTTP', { status: err.status, message: err.message });
      res.status(err.status).json({ error: err.message, ...(err.details ? { details: err.details } : {}) });
      return;
    }
    logger.error('Erro inesperado', {
      message: err instanceof Error ? err.message : String(err),
    });
    res.status(500).json({ error: 'Erro interno do servidor.' });
  });

  return app;
}

// Inicia o servidor apenas quando executado diretamente
const isMain = process.argv[1] && /server\.(ts|js)$/.test(process.argv[1].replace(/\\/g, '/'));
if (isMain) {
  const app = createApp();
  app.listen(env.PORT, () => {
    logger.info(`NEXA AI servidor rodando em http://localhost:${env.PORT}`);
  });
}
