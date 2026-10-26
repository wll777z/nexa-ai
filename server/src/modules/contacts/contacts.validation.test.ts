import { beforeAll, describe, expect, it } from 'vitest';
import request from 'supertest';

process.env.NODE_ENV = 'test';
process.env.DATABASE_PATH = ':memory:';
process.env.JWT_SECRET = 'test-secret-contact-validation';

const { createApp } = await import('../../server.js');
const app = createApp();

async function register(suffix: string) {
  const response = await request(app).post('/api/auth/register').send({
    name: 'Tester ' + suffix,
    email: suffix + '@example.com',
    password: 'safe-password-123',
    organizationName: 'Organization ' + suffix,
  });
  expect(response.status).toBe(201);
  const token = response.body.token ?? response.body.accessToken;
  expect(token).toBeTruthy();
  return token as string;
}

describe('CRM contact validation', () => {
  let token: string;
  let otherToken: string;
  let firstId: number;
  let secondId: number;

  beforeAll(async () => {
    token = await register('crm-a');
    otherToken = await register('crm-b');
    const first = await request(app).post('/api/contacts')
      .set('Authorization', 'Bearer ' + token)
      .send({ name: 'First Contact', phone: '11987654321', email: 'first@example.com' });
    const second = await request(app).post('/api/contacts')
      .set('Authorization', 'Bearer ' + token)
      .send({ name: 'Second Contact', phone: '11987654322', email: 'second@example.com' });
    expect(first.status).toBe(201);
    expect(second.status).toBe(201);
    firstId = first.body.id;
    secondId = second.body.id;
  });

  it('rejects updating a contact with an existing phone in the same organization', async () => {
    const result = await request(app).put('/api/contacts/' + secondId)
      .set('Authorization', 'Bearer ' + token)
      .send({ phone: '(11) 98765-4321' });
    expect(result.status).toBe(409);
    expect(result.body.error).toMatch(/telefone/i);
  });

  it('rejects invalid email and short name on update', async () => {
    for (const payload of [{ email: 'not-an-email' }, { name: 'X' }]) {
      const result = await request(app).put('/api/contacts/' + firstId)
        .set('Authorization', 'Bearer ' + token).send(payload);
      expect(result.status).toBe(400);
    }
  });

  it('allows unchanged phone and valid edits', async () => {
    const result = await request(app).put('/api/contacts/' + firstId)
      .set('Authorization', 'Bearer ' + token)
      .send({ phone: '11987654321', name: 'First Contact Updated' });
    expect(result.status).toBe(200);
    expect(result.body.name).toBe('First Contact Updated');
  });

  it('does not reveal another organization contact when updating', async () => {
    const result = await request(app).put('/api/contacts/' + firstId)
      .set('Authorization', 'Bearer ' + otherToken).send({ name: 'Intruder' });
    expect(result.status).toBe(404);
  });
});
