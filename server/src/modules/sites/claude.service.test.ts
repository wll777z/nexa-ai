import { describe, expect, it } from 'vitest';
import { extractHtml } from './claude.service.js';

describe('extractHtml', () => {
  it('extrai um documento completo', () => {
    const html = '<!doctype html><html><body><h1>Oi</h1></body></html>';
    expect(extractHtml(html)).toBe(html);
  });

  it('remove cercas de código e texto ao redor', () => {
    const html = '<!doctype html><html><body>x</body></html>';
    const raw = 'Aqui está:\n```html\n' + html + '\n```\nPronto!';
    expect(extractHtml(raw)).toBe(html);
  });

  it('retorna null quando a resposta foi cortada', () => {
    expect(extractHtml('<!doctype html><html><body><h1>Oi')).toBeNull();
  });

  it('retorna null quando não há HTML', () => {
    expect(extractHtml('Desculpe, não consegui.')).toBeNull();
  });
});
