import { z } from 'zod';
import { all, get, run, transaction } from '../../db/index.js';
import { badRequest } from '../../utils/errors.js';

const text = (max: number) => z.string().trim().min(1).max(max);
const optional = (max: number) => z.string().trim().max(max).optional().default('');
export const companySchema = z.object({
  name: text(160), category: text(100), city: text(100),
  state: optional(2), neighborhood: optional(100), website: optional(500),
  phone: optional(40), sourceLabel: optional(160), notes: optional(1000),
});
export type CompanyInput = z.infer<typeof companySchema>;

const normalize = (s: string) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]/g, '');
const domain = (s: string) => {
  if (!s) return '';
  try {
    const url = new URL(s.includes('://') ? s : `https://${s}`);
    if (!['http:', 'https:'].includes(url.protocol) || !url.hostname.includes('.')) return '';
    return url.hostname.toLowerCase().replace(/^www\./, '');
  } catch { return ''; }
};
const phoneDigits = (s: string) => s.replace(/\D/g, '');
const nameKey = (c: CompanyInput) => `${normalize(c.name)}|${normalize(c.city)}`;

export function validateCompany(value: unknown): CompanyInput {
  const parsed = companySchema.safeParse(value);
  if (!parsed.success) throw badRequest('Dados da empresa inválidos.', parsed.error.flatten());
  const c = parsed.data;
  if (c.website && !domain(c.website)) throw badRequest('Site inválido. Informe um domínio HTTP ou HTTPS.');
  if (c.phone && phoneDigits(c.phone).length < 8) throw badRequest('Telefone comercial inválido.');
  return c;
}

export function duplicate(orgId: number, c: CompanyInput): { id: number; kind: 'confirmed' | 'possible' } | null {
  const rows = all<{ id: number; name: string; city: string | null; website: string | null; phone: string | null }>(
    'SELECT id, name, city, website, phone FROM prospecting_leads WHERE organization_id = ? AND is_demo = 0', [orgId]);
  const d = domain(c.website);
  const p = phoneDigits(c.phone);
  for (const row of rows) {
    if (d && d === domain(row.website ?? '')) return { id: row.id, kind: 'confirmed' };
    if (p && p.length >= 10 && p === phoneDigits(row.phone ?? '')) return { id: row.id, kind: 'confirmed' };
    if (nameKey(c) === nameKey({ ...c, name: row.name, city: row.city ?? '' })) {
      return { id: row.id, kind: 'possible' };
    }
  }
  return null;
}

export function addCompany(orgId: number, c: CompanyInput, source: 'manual' | 'csv') {
  const match = duplicate(orgId, c);
  if (match) return { status: match.kind === 'confirmed' ? 'duplicate' : 'possible_duplicate', leadId: match.id };
  const key = `${normalize(c.name)}|${normalize(c.city)}`;
  const suppressed = get<{ id: number }>('SELECT id FROM prospecting_suppressions WHERE organization_id = ? AND dedupe_key = ?', [orgId, key]);
  if (suppressed) return { status: 'suppressed', leadId: null };
  try {
    const inserted = run(`INSERT INTO prospecting_leads
      (organization_id, name, category, city, state, neighborhood, website, phone, source, source_label, notes, reason, priority, dedupe_key, is_demo)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'media', ?, 0)`,
      [orgId, c.name, c.category, c.city, c.state || null, c.neighborhood || null, c.website || null, c.phone || null,
       source, c.sourceLabel || null, c.notes || null, 'Dados fornecidos pelo usuário; presença digital ainda não verificada.', key]);
    return { status: 'created', leadId: Number(inserted.lastInsertRowid) };
  } catch (error) {
    if (String(error).includes('UNIQUE constraint failed')) return { status: 'possible_duplicate', leadId: null };
    throw error;
  }
}

type PreviewRow = { line: number; company?: CompanyInput; error?: string; match?: ReturnType<typeof duplicate> };
const headers: Record<string, keyof CompanyInput> = {
  nome: 'name', name: 'name', empresa: 'name', segmento: 'category', categoria: 'category',
  category: 'category', cidade: 'city', city: 'city', estado: 'state', uf: 'state',
  bairro: 'neighborhood', site: 'website', website: 'website', telefone: 'phone',
  fonte: 'sourceLabel', observacoes: 'notes', observação: 'notes',
};

function parseCsv(csv: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [], cell = '', quoted = false;
  for (let i = 0; i < csv.length; i++) {
    const ch = csv[i];
    if (ch === '"') {
      if (quoted && csv[i + 1] === '"') { cell += '"'; i++; }
      else if (quoted || cell === '') quoted = !quoted;
      else throw badRequest('CSV com aspas inválidas.');
    } else if (ch === ',' && !quoted) { row.push(cell); cell = ''; }
    else if ((ch === '\n' || ch === '\r') && !quoted) {
      if (ch === '\r' && csv[i + 1] === '\n') i++;
      row.push(cell); if (row.some(v => v.trim())) rows.push(row);
      row = []; cell = '';
    } else cell += ch;
  }
  if (quoted) throw badRequest('CSV com aspas não fechadas.');
  row.push(cell); if (row.some(v => v.trim())) rows.push(row);
  return rows;
}

export function previewCsv(orgId: number, csv: string): PreviewRow[] {
  if (Buffer.byteLength(csv, 'utf8') > 256_000) throw badRequest('CSV excede 256 KB.');
  const rows = parseCsv(csv.replace(/^\uFEFF/, ''));
  if (rows.length < 2) throw badRequest('CSV vazio ou sem linhas de dados.');
  if (rows.length > 501) throw badRequest('CSV excede 500 empresas.');
  const columns = rows[0].map(h => headers[h.trim().toLowerCase()]);
  if (!columns.includes('name') || !columns.includes('category') || !columns.includes('city')) {
    throw badRequest('CSV precisa das colunas nome, segmento e cidade.');
  }
  const seen = new Set<string>();
  return rows.slice(1).map((cells, index) => {
    if (cells.length !== columns.length) return { line: index + 2, error: 'Quantidade de colunas inválida.' };
    if (cells.some(cell => /^[\s]*[=+@\t\r]/.test(cell))) return { line: index + 2, error: 'Conteúdo de planilha potencialmente inseguro.' };
    const data: Record<string, string> = {};
    columns.forEach((column, i) => { if (column) data[column] = cells[i].trim(); });
    try {
      const company = validateCompany(data);
      const key = nameKey(company);
      if (seen.has(key)) return { line: index + 2, company, error: 'Possível duplicata no CSV.' };
      seen.add(key);
      return { line: index + 2, company, match: duplicate(orgId, company) };
    } catch (error) { return { line: index + 2, error: error instanceof Error ? error.message : 'Linha inválida.' }; }
  });
}

export function confirmCsv(orgId: number, userId: number, filename: string, csv: string) {
  const rows = previewCsv(orgId, csv);
  return transaction(() => {
    let imported = 0;
    const results = rows.map(row => {
      if (!row.company || row.error || row.match) return { line: row.line, status: row.error || row.match?.kind || 'invalid' };
      const result = addCompany(orgId, row.company, 'csv');
      if (result.status === 'created') imported++;
      return { line: row.line, status: result.status };
    });
    run('INSERT INTO prospecting_imports (organization_id, user_id, filename, total_rows, imported_rows, rejected_rows) VALUES (?, ?, ?, ?, ?, ?)',
      [orgId, userId, filename, rows.length, imported, rows.length - imported]);
    return { total: rows.length, imported, rejected: rows.length - imported, results };
  });
}
