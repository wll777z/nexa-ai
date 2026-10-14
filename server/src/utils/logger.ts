import { appendFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

type Level = 'info' | 'warn' | 'error';

function write(level: Level, msg: string, data?: unknown): void {
  const line = JSON.stringify({
    ts: new Date().toISOString(),
    level,
    msg,
    ...(data !== undefined ? { data } : {}),
  });
  // stdout para o console
  (level === 'error' ? console.error : level === 'warn' ? console.warn : console.log)(line);
  // arquivo local para auditoria
  try {
    const file = resolve('./data/nexa.log');
    mkdirSync(dirname(file), { recursive: true });
    appendFileSync(file, line + '\n');
  } catch {
    // falha ao gravar log em disco não deve derrubar a aplicação
  }
}

export const logger = {
  info: (msg: string, data?: unknown) => write('info', msg, data),
  warn: (msg: string, data?: unknown) => write('warn', msg, data),
  error: (msg: string, data?: unknown) => write('error', msg, data),
};
