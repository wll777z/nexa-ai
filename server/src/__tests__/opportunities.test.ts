import { describe, expect, it } from 'vitest';
import request from 'supertest';
import { createApp } from '../server.js';

const app = createApp();
const base = '/api/prospecting';
async function account(email: string) {
  const result = await request(app).post('/api/auth/register').send({ name: 'Teste', email, password: 'senha-segura-123', organizationName: email });
  expect(result.status).toBe(201);
  return { Authorization: `Bearer ${result.body.token}` };
}
const company = { name: 'Empresa Real de Teste', category: 'Serviços', city: 'Recife', state: 'PE', neighborhood: 'Boa Viagem', website: 'https://empresa.example', phone: '81999998888' };

describe('Sprint 1: oportunidades reais', () => {
  it('exige autenticação', async () => {
    expect((await request(app).post(`${base}/leads/manual`).send(company)).status).toBe(403);
  });

  it('cadastra, filtra e isola empresas por organização', async () => {
    const one = await account('opportunities-one@nexa.test');
    const two = await account('opportunities-two@nexa.test');
    const created = await request(app).post(`${base}/leads/manual`).set(one).send(company);
    expect(created.status).toBe(201);
    const duplicate = await request(app).post(`${base}/leads/manual`).set(one).send({ ...company, name: 'Outro nome' });
    expect(duplicate.status).toBe(409);
    expect(duplicate.body.status).toBe('duplicate');
    const list = await request(app).get(`${base}/leads?city=Recife&state=PE&neighborhood=Boa%20Viagem&source=manual&websiteStatus=provided`).set(one);
    expect(list.body.data.some((lead: { id: number }) => lead.id === created.body.leadId)).toBe(true);
    const possible = await request(app).post(`${base}/leads/manual`).set(one).send({ ...company, phone: '', website: '' });
    expect(possible.status).toBe(409);
    expect(possible.body.status).toBe('possible_duplicate');
    const isolated = await request(app).get(`${base}/leads?search=Empresa Real de Teste`).set(two);
    expect(isolated.body.total).toBe(0);
    expect((await request(app).post(`${base}/leads/manual`).set(two).send(company)).status).toBe(201);
  });

  it('faz prévia, rejeita linhas inválidas e confirma somente linhas válidas', async () => {
    const auth = await account('opportunities-csv@nexa.test');
    const csv = 'nome,segmento,cidade,site,observacoes\n"Padaria, Central",Alimentos,Salvador,https://padaria.example,"Perto da praça"\nSem cidade,Serviços,,\n"Padaria, Central",Alimentos,Salvador,https://padaria.example,Repetida\n';
    const preview = await request(app).post(`${base}/import/preview`).set(auth).send({ csv });
    expect(preview.status).toBe(200);
    expect(preview.body.rows).toHaveLength(3);
    expect(preview.body.rows[0].company.name).toBe('Padaria, Central');
    expect(preview.body.rows[1].error).toBeTruthy();
    expect(preview.body.rows[2].error).toBeTruthy();
    const confirmed = await request(app).post(`${base}/import/confirm`).set(auth).send({ csv, filename: 'empresas.csv' });
    expect(confirmed.status).toBe(200);
    expect(confirmed.body).toMatchObject({ total: 3, imported: 1, rejected: 2 });
    const repeated = await request(app).post(`${base}/import/confirm`).set(auth).send({ csv, filename: 'empresas.csv' });
    expect(repeated.body.imported).toBe(0);
    expect((await request(app).post(`${base}/import/preview`).set(auth).send({ csv: 'nome,segmento,cidade\n' })).status).toBe(400);
    expect((await request(app).post(`${base}/import/preview`).set(auth).send({ csv: 'x'.repeat(256001) })).status).toBe(400);
    const unsafe = await request(app).post(`${base}/import/preview`).set(auth).send({ csv: 'nome,segmento,cidade\n=HYPERLINK(1),Serviços,Recife' });
    expect(unsafe.body.rows[0].error).toContain('inseguro');
  });
});
