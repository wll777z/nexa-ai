import { mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { env } from '../config/env.js';

// createRequire evita que o bundler tente transformar o builtin node:sqlite
import { createRequire } from 'node:module';
const require_ = createRequire(import.meta.url);
const { DatabaseSync } = require_('node:sqlite') as { DatabaseSync: typeof import('node:sqlite').DatabaseSync };

export type Db = InstanceType<typeof DatabaseSync>;

let instance: Db | null = null;

/**
 * Abre (e cria se necessário) o banco SQLite local.
 * Todo acesso ao banco passa por aqui — trocar por PostgreSQL/Supabase
 * no futuro significa reescrever apenas este módulo.
 */
export function getDb(): Db {
  if (instance) return instance;

  // Em testes usa banco em memória para isolamento total
  const dbPath = process.env.NODE_ENV === 'test' ? ':memory:' : env.DATABASE_PATH;
  const filePath = dbPath === ':memory:' ? dbPath : resolve(dbPath);
  if (filePath !== ':memory:') mkdirSync(dirname(filePath), { recursive: true });

  const db = new DatabaseSync(filePath);
  db.exec('PRAGMA journal_mode = WAL;');
  db.exec('PRAGMA foreign_keys = ON;');
  instance = db;
  return db;
}

/** Fecha a conexão — usado nos testes. */
export function closeDb(): void {
  instance?.close();
  instance = null;
}

/** Executa um script SQL simples (sem parâmetros). */
export function exec(sql: string): void {
  getDb().exec(sql);
}

export interface RunResult {
  changes: number;
  lastInsertRowid: number | bigint;
}

/** Executa INSERT/UPDATE/DELETE com parâmetros posicionais. */
export function run(sql: string, params: unknown[] = []): RunResult {
  const stmt = getDb().prepare(sql);
  const res = stmt.run(...(params as never[]));
  return { changes: Number(res.changes), lastInsertRowid: res.lastInsertRowid };
}

/** Retorna a primeira linha de uma consulta, ou undefined. */
export function get<T>(sql: string, params: unknown[] = []): T | undefined {
  const stmt = getDb().prepare(sql);
  return stmt.get(...(params as never[])) as T | undefined;
}

/** Retorna todas as linhas de uma consulta. */
export function all<T>(sql: string, params: unknown[] = []): T[] {
  const stmt = getDb().prepare(sql);
  return stmt.all(...(params as never[])) as T[];
}

/** Transação: executa fn e faz rollback automático em caso de erro. */
export function transaction<T>(fn: () => T): T {
  const db = getDb();
  db.exec('BEGIN');
  try {
    const result = fn();
    db.exec('COMMIT');
    return result;
  } catch (err) {
    db.exec('ROLLBACK');
    throw err;
  }
}
