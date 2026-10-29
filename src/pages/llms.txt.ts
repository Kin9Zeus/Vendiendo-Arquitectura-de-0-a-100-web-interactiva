import type { APIRoute } from 'astro';
import { BOOK, CHAPTERS, FAQ, AUTHOR_BIO } from '../data/book';
import { SITE, CONTACT } from '../config/site';

/** llms.txt — resumen estructurado para asistentes de IA (https://llmstxt.org). */
export const GET: APIRoute = ({ site }) => {
  const u = (p: string) => new URL(p, site).href;
  const lines = [
    `# ${BOOK.title}`,
    '',
    `> ${SITE.description}`,
    '',
    `- Autor: ${BOOK.author} — ${BOOK.authorRole}`,
    `- Colección: ${BOOK.collection}, ${BOOK.volume} · ${BOOK.edition}`,
    `- Editorial: ${BOOK.publisher} (${BOOK.city}) · ${BOOK.pages} páginas · ${BOOK.format} · ${BOOK.size}`,
    `- Incluye: acceso gratuito al Curso de Redes Sociales, Mercadeo e Instagram para Arquitectos de UVA Academia`,
    `- Compra: WhatsApp https://wa.me/${CONTACT.whatsapp} · ${CONTACT.email}`,
    '',
    '## Autor',
    '',
    ...AUTHOR_BIO,
    '',
    '## Capítulos',
    '',
    ...CHAPTERS.map((c) => `- [Capítulo ${c.n}: ${c.title}](${u(`/capitulos/${c.slug}`)}): ${c.summary}`),
    '',
    '## Preguntas frecuentes',
    '',
    ...FAQ.flatMap((f) => [`### ${f.q}`, '', f.a, '']),
    '## Optional',
    '',
    `- [Índice completo](${u('/capitulos')})`,
    `- [Aviso de privacidad](${u('/privacidad')})`,
    '',
  ];
  return new Response(lines.join('\n'), { headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
};
