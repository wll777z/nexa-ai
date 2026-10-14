/**
 * Contrato do serviço de geração de sites (ai.service).
 *
 * Regras verificadas:
 * 1. Sem AI_API_KEY -> gera localmente e reporta source: 'local'.
 * 2. Com AI_API_KEY válida -> usa a IA e reporta source: 'ai'.
 * 3. Se a IA falhar (rede, 401, JSON inválido) -> cai para o gerador local.
 * 4. O gerador local extrai segmento, serviços e contatos do briefing.
 * 5. A saída tem sempre a mesma forma (chaves obrigatórias presentes).
 */
import { describe, it, expect, afterEach, vi } from 'vitest';
import type { SiteBrief } from './site.model.js';

async function loadService() {
  vi.resetModules();
  return import('./ai.service.js');
}

const ORIGINAL_ENV = process.env;

afterEach(() => {
  process.env = { ...ORIGINAL_ENV };
  vi.restoreAllMocks();
});

const barbearia: SiteBrief = {
  companyName: 'Barbearia do Zé',
  description: 'Barbearia, cortes masculinos e barba. WhatsApp (67) 99999-8888.',
};

describe('ai.service — contrato', () => {
  it('sem AI_API_KEY gera localmente e reporta source=local', async () => {
    delete process.env.AI_API_KEY;
    const { generateSite, isAIConfigured } = await loadService();
    expect(isAIConfigured()).toBe(false);

    const { content, source } = await generateSite(barbearia);
    expect(source).toBe('local');
    expect(content.hero.title).toBe('Barbearia do Zé');
    expect(content.services.items).toContain('Corte masculino');
    expect(content.contact.whatsapp).toBe('(67) 99999-8888');
    expect(content.layout).toBe('barbearia');
  });

  it('com AI_API_KEY chama a API e reporta source=ai', async () => {
    process.env.AI_API_KEY = 'test-key';
    process.env.AI_API_URL = 'http://fake.local/v1/chat';
    process.env.AI_MODEL = 'test-model';

    const fakeResponse = {
      choices: [{ message: { content: JSON.stringify({
        layout: 'generico',
        hero: { title: 'T', subtitle: 'S', cta: 'C' },
        about: { title: 'A', text: 'texto' },
        differentials: { title: 'D', items: ['d1'] },
        services: { title: 'Serv', items: ['x', 'y'] },
        faq: { title: 'F', items: [] },
        gallery: { title: 'G', images: [] },
        contact: { title: 'Ct', whatsapp: 'w', email: 'e', phone: 'p', address: '', instagram: '' },
        footer: { text: 'rodape' },
        colors: { primary: '#000', background: '#111' },
      }) } }],
    };

    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify(fakeResponse), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    );

    const { generateSite } = await loadService();
    const { content, source } = await generateSite(barbearia);

    expect(source).toBe('ai');
    expect(fetchSpy).toHaveBeenCalledOnce();
    expect(content.hero.title).toBe('T');
    expect(content.services.items).toEqual(['x', 'y']);
    expect(content.layout).toBe('generico');
  });

  it('quando a IA falhar, cai para o gerador local', async () => {
    process.env.AI_API_KEY = 'test-key';
    process.env.AI_API_URL = 'http://fake.local/v1/chat';

    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response('unauthorized', { status: 401 }),
    );

    const { generateSite } = await loadService();
    const { source } = await generateSite({ companyName: 'Salão Bella', description: 'Salão de beleza, corte e escova.' });
    expect(source).toBe('local');
  });

  it('detecta segmento e serviços de cada tipo de negócio', async () => {
    delete process.env.AI_API_KEY;
    const { generateSite } = await loadService();

    const rest = await generateSite({ companyName: 'Sabor Caseiro', description: 'Restaurante de comida caseira com delivery.' });
    expect(rest.content.services.items).toContain('Delivery');
    expect(rest.content.colors.primary).toBe('#dc2626');

    const acad = await generateSite({ companyName: 'Iron Gym', description: 'Academia com musculação e personal.' });
    expect(acad.content.services.items).toContain('Musculação');
    expect(acad.content.colors.primary).toBe('#16a34a');
  });

  it('usa os campos de contato do briefing antes de regex', async () => {
    delete process.env.AI_API_KEY;
    const { generateSite } = await loadService();

    const { content } = await generateSite({
      companyName: 'Clínica Vida',
      phone: '(67) 98888-7777',
      email: 'contato@clinicavida.com',
      instagram: '@clinicavida',
    });
    expect(content.contact.phone).toBe('(67) 98888-7777');
    expect(content.contact.email).toBe('contato@clinicavida.com');
    expect(content.contact.instagram).toBe('@clinicavida');
  });

  it('saída tem sempre a mesma forma, mesmo com entrada mínima', async () => {
    delete process.env.AI_API_KEY;
    const { generateSite } = await loadService();

    const { content } = await generateSite({ companyName: 'Minimo' });
    expect(content).toHaveProperty('hero');
    expect(content).toHaveProperty('about');
    expect(content).toHaveProperty('differentials');
    expect(content).toHaveProperty('services');
    expect(content).toHaveProperty('faq');
    expect(content).toHaveProperty('gallery');
    expect(content).toHaveProperty('contact');
    expect(content).toHaveProperty('footer');
    expect(content).toHaveProperty('colors');
    expect(Array.isArray(content.services.items)).toBe(true);
  });
});
