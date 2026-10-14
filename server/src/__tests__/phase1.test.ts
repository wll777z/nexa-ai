/**
 * Testes da Fase 1 — cadastro, login, contatos, isolamento entre
 * organizações, bloqueio de destinatários e dashboard.
 *
 * Usa banco em memória (configurado em .env.test carregado via vitest).
 */
import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { createApp } from '../server.js';

const app = createApp();

let token = '';
let orgId = 0;

async function api() {
  return request(app);
}

function authHeader() {
  return { Authorization: `Bearer ${token}` };
}

describe('Fase 1 — NEXA AI', () => {
  it('GET /api/health responde ok sem autenticação', async () => {
    const res = await (await api()).get('/api/health');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
  });

  it('registra um novo usuário e organização', async () => {
    const res = await (await api()).post('/api/auth/register').send({
      name: 'Dono Teste',
      email: 'dono@nexa.test',
      password: 'senha-segura-123',
      organizationName: 'Empresa Teste LTDA',
    });
    expect(res.status).toBe(201);
    expect(res.body.token).toBeTruthy();
    expect(res.body.user.role).toBe('owner');
    token = res.body.token;
    orgId = res.body.user.organizationId;
  });

  it('rejeita e-mail duplicado no registro', async () => {
    const res = await (await api()).post('/api/auth/register').send({
      name: 'Outro Dono',
      email: 'dono@nexa.test',
      password: 'senha-segura-123',
      organizationName: 'Outra Empresa',
    });
    expect(res.status).toBe(409);
  });

  it('rejeita senha fraca', async () => {
    const res = await (await api()).post('/api/auth/register').send({
      name: 'Fraca Senha',
      email: 'fraca@nexa.test',
      password: '123',
      organizationName: 'Empresa Fraca',
    });
    expect(res.status).toBe(400);
  });

  it('faz login com as credenciais corretas', async () => {
    const res = await (await api()).post('/api/auth/login').send({
      email: 'dono@nexa.test',
      password: 'senha-segura-123',
    });
    expect(res.status).toBe(200);
    expect(res.body.token).toBeTruthy();
  });

  it('recusa login com senha errada', async () => {
    const res = await (await api()).post('/api/auth/login').send({
      email: 'dono@nexa.test',
      password: 'senha-errada',
    });
    expect(res.status).toBe(400);
  });

  it('protege /api/auth/me sem token', async () => {
    const res = await (await api()).get('/api/auth/me');
    expect(res.status).toBe(403);
  });

  it('GET /api/auth/me com token devolve o usuário', async () => {
    const res = await (await api()).get('/api/auth/me').set(authHeader());
    expect(res.status).toBe(200);
    expect(res.body.email).toBe('dono@nexa.test');
  });

  it('cria um contato com consentimento e etiquetas', async () => {
    const res = await (await api())
      .post('/api/contacts')
      .set(authHeader())
      .send({
        name: 'Maria Silva',
        phone: '(11) 98888-7777',
        email: 'maria@cliente.test',
        company: 'Silva ME',
        source: 'site',
        interest: 'Site institucional',
        consent: true,
        tags: ['VIP', 'Site'],
      });
    expect(res.status).toBe(201);
    expect(res.body.id).toBeGreaterThan(0);
    expect(res.body.phone).toBe('5511988887777');
    expect(res.body.tags).toContain('VIP');
  });

  it('rejeita contato com e-mail duplicado', async () => {
    const res = await (await api())
      .post('/api/contacts')
      .set(authHeader())
      .send({ name: 'Maria Clone', email: 'maria@cliente.test' });
    expect(res.status).toBe(409);
  });

  it('rejeita telefone inválido', async () => {
    const res = await (await api())
      .post('/api/contacts')
      .set(authHeader())
      .send({ name: 'Tel Ruim', phone: '123' });
    expect(res.status).toBe(400);
  });

  it('lista contatos e filtra por nome', async () => {
    const res = await (await api()).get('/api/contacts?q=Maria').set(authHeader());
    expect(res.status).toBe(200);
    expect(res.body.total).toBe(1);
    expect(res.body.data[0].name).toBe('Maria Silva');
  });

  it('seleciona destinatários e separa os bloqueados', async () => {
    // cria contatos: um sem consentimento, um com opt-out
    const semConsent = await (await api())
      .post('/api/contacts')
      .set(authHeader())
      .send({ name: 'Sem Consentimento', phone: '11977776666', consent: false });
    expect(semConsent.status).toBe(201);
    expect(semConsent.body.consent).toBe(0);
    const optOut = await (await api())
      .post('/api/contacts')
      .set(authHeader())
      .send({ name: 'Pediu Saida', phone: '11966665555', consent: true, opt_out: true });
    expect(optOut.status).toBe(201);
    expect(optOut.body.opt_out).toBe(1);

    const res = await (await api())
      .post('/api/contacts/select')
      .set(authHeader())
      .send({ ids: [semConsent.body.id, optOut.body.id] });
    expect(res.status).toBe(200);
    expect(res.body.totalEligible).toBe(0);
    expect(res.body.totalBlocked).toBe(2);
    expect(res.body.blocked.map((b: { reason: string }) => b.reason).join(' ')).toContain('opt-out');
  });

  it('dashboard devolve números reais do banco', async () => {
    const res = await (await api()).get('/api/dashboard/overview').set(authHeader());
    expect(res.status).toBe(200);
    expect(res.body.totals.contacts).toBeGreaterThanOrEqual(3);
    expect(Array.isArray(res.body.byStage)).toBe(true);
    expect(res.body.recentContacts.length).toBeGreaterThan(0);
  });

  it('isola dados entre organizações', async () => {
    // registra segunda organização
    const reg = await (await api()).post('/api/auth/register').send({
      name: 'Outra Org',
      email: 'outra@nexa.test',
      password: 'senha-segura-123',
      organizationName: 'Segunda Empresa',
    });
    const otherToken = reg.body.token;

    // a segunda organização não vê contatos da primeira
    const res = await (await api()).get('/api/contacts').set({ Authorization: `Bearer ${otherToken}` });
    expect(res.status).toBe(200);
    expect(res.body.total).toBe(0);

    // e não consegue alterar contato da primeira
    const upd = await (await api())
      .put('/api/contacts/1')
      .set({ Authorization: `Bearer ${otherToken}` })
      .send({ name: 'Hackeado' });
    expect(upd.status).toBe(404);
  });
});
