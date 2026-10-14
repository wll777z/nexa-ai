import type { SiteContent } from '../types/site';

/**
 * Gera um HTML standalone e autocontido a partir do conteúdo do site.
 * Usado dentro de um <iframe srcDoc sandbox> para prévia segura — nunca
 * injetamos HTML direto no DOM da aplicação.
 */
export function buildSiteHtml(content: SiteContent): string {
  const c = content.colors;
  const bg = c.background || '#0a0a0b';
  const isLight = isLightColor(bg);
  const fg = isLight ? '#18181b' : '#f4f4f5';
  const muted = isLight ? 'rgba(24,24,27,0.6)' : 'rgba(244,244,245,0.66)';
  const border = isLight ? 'rgba(24,24,27,0.12)' : 'rgba(244,245,245,0.14)';
  const primary = c.primary || '#6366f1';

  const esc = (s: string) =>
    String(s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');

  const waLink = (p: string) => `https://wa.me/${p.replace(/\D/g, '')}`;

  const section = (title: string, body: string) => `
    <section style="padding:48px 24px;border-bottom:1px solid ${border};max-width:1080px;margin:0 auto">
      <h2 style="font-size:12px;letter-spacing:.18em;text-transform:uppercase;color:${primary};margin:0 0 28px">${esc(title)}</h2>
      ${body}
    </section>`;

  const servicesHtml = content.services.items.length
    ? section(
        content.services.title,
        `<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(220px,1fr));gap:16px">
          ${content.services.items
            .map(
              (i) =>
                `<div style="padding:20px;border:1px solid ${border};border-radius:10px;font-size:15px">${esc(i)}</div>`,
            )
            .join('')}
        </div>`,
      )
    : '';

  const diffHtml = content.differentials.items.length
    ? section(
        content.differentials.title,
        `<ul style="list-style:none;padding:0;margin:0;display:grid;grid-template-columns:repeat(auto-fill,minmax(260px,1fr));gap:12px">
          ${content.differentials.items
            .map(
              (i) =>
                `<li style="font-size:15px;color:${muted}"><span style="color:${primary};margin-right:8px">—</span>${esc(i)}</li>`,
            )
            .join('')}
        </ul>`,
      )
    : '';

  const aboutHtml = content.about.text
    ? section(
        content.about.title,
        `<p style="font-size:16px;line-height:1.7;color:${muted};max-width:640px;margin:0">${esc(content.about.text)}</p>`,
      )
    : '';

  const galleryHtml = content.gallery.images.length
    ? section(
        content.gallery.title,
        `<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(160px,1fr));gap:12px">
          ${content.gallery.images
            .map((s) => `<img src="${esc(s)}" alt="" style="width:100%;height:140px;object-fit:cover;border-radius:10px" />`)
            .join('')}
        </div>`,
      )
    : '';

  const faqHtml = content.faq.items.length
    ? section(
        content.faq.title,
        `<div style="display:flex;flex-direction:column;gap:12px;max-width:720px">
          ${content.faq.items
            .map(
              (f) =>
                `<details style="padding:16px;border:1px solid ${border};border-radius:10px">
                   <summary style="font-size:15px;font-weight:600;cursor:pointer">${esc(f.q)}</summary>
                   <p style="font-size:14px;color:${muted};margin:12px 0 0">${esc(f.a)}</p>
                 </details>`,
            )
            .join('')}
        </div>`,
      )
    : '';

  const contactLines: string[] = [];
  if (content.contact.whatsapp)
    contactLines.push(
      `<a href="${waLink(content.contact.whatsapp)}" style="color:${fg};text-decoration:none;font-size:15px">WhatsApp: ${esc(content.contact.whatsapp)}</a>`,
    );
  if (content.contact.phone)
    contactLines.push(`<span style="font-size:15px;color:${muted}">Telefone: ${esc(content.contact.phone)}</span>`);
  if (content.contact.email)
    contactLines.push(
      `<a href="mailto:${esc(content.contact.email)}" style="color:${fg};text-decoration:none;font-size:15px">${esc(content.contact.email)}</a>`,
    );
  if (content.contact.address)
    contactLines.push(`<span style="font-size:15px;color:${muted}">${esc(content.contact.address)}</span>`);
  if (content.contact.instagram)
    contactLines.push(
      `<a href="https://instagram.com/${esc(content.contact.instagram.replace('@', ''))}" style="color:${fg};text-decoration:none;font-size:15px">Instagram: ${esc(content.contact.instagram)}</a>`,
    );
  const contactHtml = section(
    content.contact.title,
    `<div style="display:flex;flex-direction:column;gap:10px">${contactLines.join('') || `<span style="color:${muted}">—</span>`}</div>`,
  );

  const navLinks = [content.about.title, content.services.title, content.contact.title]
    .filter(Boolean)
    .map((l) => `<a href="#" style="font-size:13px;color:${muted};text-decoration:none">${esc(l)}</a>`)
    .join('');

  return `<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${esc(content.hero.title)}</title>
<style>
  * { box-sizing: border-box; }
  body { margin:0; background:${bg}; color:${fg}; font-family: Inter, system-ui, -apple-system, sans-serif; }
  a:hover { opacity:.85; }
</style>
</head>
<body>
  <header style="display:flex;align-items:center;justify-content:space-between;padding:18px 24px;border-bottom:1px solid ${border};max-width:1080px;margin:0 auto">
    <strong style="font-size:16px;letter-spacing:-.01em">${esc(content.hero.title)}</strong>
    <nav style="display:flex;gap:22px">${navLinks}</nav>
  </header>

  <section style="padding:88px 24px;text-align:center;border-bottom:1px solid ${border}">
    <h1 style="font-size:clamp(28px,5vw,44px);font-weight:800;letter-spacing:-.02em;line-height:1.15;max-width:720px;margin:0 auto">${esc(content.hero.title)}</h1>
    <p style="font-size:16px;color:${muted};max-width:520px;margin:20px auto 0">${esc(content.hero.subtitle)}</p>
    ${content.hero.cta ? `<a href="${esc(content.hero.ctaLink || '#')}" ${content.hero.ctaLink ? 'target="_blank" rel="noreferrer"' : ''} style="display:inline-block;margin-top:32px;padding:14px 28px;border-radius:10px;background:${primary};color:#fff;font-size:15px;font-weight:600;text-decoration:none">${esc(content.hero.cta)}</a>` : ''}
  </section>

  ${servicesHtml}
  ${diffHtml}
  ${aboutHtml}
  ${galleryHtml}
  ${faqHtml}
  ${contactHtml}

  <footer style="padding:28px 24px;text-align:center;font-size:13px;color:${muted}">${esc(content.footer.text)}</footer>
</body>
</html>`;
}

function isLightColor(hex: string): boolean {
  const m = hex.replace('#', '');
  if (m.length < 6) return false;
  const r = parseInt(m.slice(0, 2), 16);
  const g = parseInt(m.slice(2, 4), 16);
  const b = parseInt(m.slice(4, 6), 16);
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255 > 0.6;
}

const LAYOUT_LABELS: Record<string, string> = {
  barbearia: 'Clássico',
  salao: 'Elegante',
  restaurante: 'Acolhedor',
  loja: 'Moderno',
  clinica: 'Confiança',
  servico: 'Direto',
  generico: 'Padrão',
};

export function layoutLabel(layout: string): string {
  return LAYOUT_LABELS[layout] ?? layout;
}
