import { closeDb, getDb } from './index.js';

interface Migration {
  id: number;
  name: string;
  sql: string;
}

const migrations: Migration[] = [
  {
    id: 1,
    name: 'organizations_users_contacts_tags',
    sql: `
-- ── Organizações (isolamento multi-tenant) ──────────────────────────────
CREATE TABLE IF NOT EXISTS organizations (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  name        TEXT    NOT NULL,
  created_at  TEXT    NOT NULL DEFAULT (datetime('now'))
);

-- ── Usuários ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS users (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  organization_id INTEGER NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name            TEXT    NOT NULL,
  email           TEXT    NOT NULL UNIQUE,
  password_hash   TEXT    NOT NULL,
  role            TEXT    NOT NULL DEFAULT 'owner' CHECK (role IN ('owner','admin','member')),
  created_at      TEXT    NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_users_org ON users(organization_id);

-- ── Contatos (CRM) ──────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS contacts (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  organization_id INTEGER NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name            TEXT    NOT NULL,
  phone           TEXT,
  whatsapp        TEXT,
  email           TEXT,
  company         TEXT,
  source          TEXT,
  interest        TEXT,
  stage           TEXT    NOT NULL DEFAULT 'new_lead'
                  CHECK (stage IN ('new_lead','first_contact','in_service','qualified',
                                   'quote_sent','awaiting_reply','negotiation','converted','lost')),
  next_action     TEXT,
  notes           TEXT,
  consent         INTEGER NOT NULL DEFAULT 0 CHECK (consent IN (0,1)),
  opt_out         INTEGER NOT NULL DEFAULT 0 CHECK (opt_out IN (0,1)),
  last_contact_at TEXT,
  created_at      TEXT    NOT NULL DEFAULT (datetime('now')),
  updated_at      TEXT    NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_contacts_org  ON contacts(organization_id);
CREATE INDEX IF NOT EXISTS idx_contacts_stage ON contacts(stage);
CREATE UNIQUE INDEX IF NOT EXISTS idx_contacts_org_email ON contacts(organization_id, email)
  WHERE email IS NOT NULL AND email <> '';
CREATE UNIQUE INDEX IF NOT EXISTS idx_contacts_org_phone ON contacts(organization_id, phone)
  WHERE phone IS NOT NULL AND phone <> '';

-- ── Etiquetas ───────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS tags (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  organization_id INTEGER NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name            TEXT    NOT NULL,
  UNIQUE (organization_id, name)
);

CREATE TABLE IF NOT EXISTS contact_tags (
  contact_id INTEGER NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
  tag_id     INTEGER NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
  PRIMARY KEY (contact_id, tag_id)
);

-- ── Log de auditoria (ações administrativas) ────────────────────────────
CREATE TABLE IF NOT EXISTS audit_log (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id    INTEGER REFERENCES users(id) ON DELETE SET NULL,
  action     TEXT NOT NULL,
  entity     TEXT,
  entity_id  INTEGER,
  detail     TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_audit_created ON audit_log(created_at);
`,
  },
  {
    id: 2,
    name: 'site_projects',
    sql: `
-- ── Projetos de sites (criador assistido) ──────────────────────────────
CREATE TABLE IF NOT EXISTS site_projects (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  organization_id INTEGER NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id         INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name            TEXT    NOT NULL,
  brief           TEXT,
  content_json    TEXT,
  status          TEXT    NOT NULL DEFAULT 'draft'
                  CHECK (status IN ('draft','ready','publishing','published')),
  created_at      TEXT    NOT NULL DEFAULT (datetime('now')),
  updated_at      TEXT    NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_sites_org ON site_projects(organization_id);
`,
  },
];

/** Aplica todas as migrations pendentes. Idempotente. */
export function migrate(): { applied: string[] } {
  const db = getDb();
  db.exec(`
    CREATE TABLE IF NOT EXISTS migrations (
      id         INTEGER PRIMARY KEY,
      name       TEXT NOT NULL,
      applied_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);

  const applied: string[] = [];
  for (const m of migrations) {
    const row = db
      .prepare('SELECT id FROM migrations WHERE id = ?')
      .get(m.id);
    if (row) continue;
    db.exec('BEGIN');
    try {
      db.exec(m.sql);
      db.prepare('INSERT INTO migrations (id, name) VALUES (?, ?)').run(m.id, m.name);
      db.exec('COMMIT');
      applied.push(`${m.id}_${m.name}`);
    } catch (err) {
      db.exec('ROLLBACK');
      throw new Error(`Falha ao aplicar migration ${m.id} (${m.name}): ${String(err)}`);
    }
  }
  return { applied };
}

// Permite executar via: npm run migrate
if (process.argv[1]?.endsWith('migrate.ts') || process.argv[1]?.endsWith('migrate.js')) {
  const { applied } = migrate();
  console.log(
    applied.length > 0
      ? `Migrations aplicadas: ${applied.join(', ')}`
      : 'Nenhuma migration pendente.',
  );
  closeDb();
}
