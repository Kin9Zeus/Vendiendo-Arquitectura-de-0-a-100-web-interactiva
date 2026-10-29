import type { APIRoute } from 'astro';
import { IS_PREVIEW } from '../config/site';

// Buscadores y asistentes de IA son bienvenidos (SEO + GEO).
const AI_BOTS = ['GPTBot', 'OAI-SearchBot', 'ChatGPT-User', 'ClaudeBot', 'Claude-SearchBot', 'Claude-User', 'PerplexityBot', 'Google-Extended', 'Applebot-Extended'];

export const GET: APIRoute = ({ site }) => {
  if (IS_PREVIEW) {
    // Vista previa: no indexar (evita contenido duplicado con el dominio oficial)
    return new Response('User-agent: *\nDisallow: /\n', { headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
  }
  const body = [
    '# Vendiendo arquitectura de 0 a 100 — Editorial UVA',
    'User-agent: *',
    'Allow: /',
    'Disallow: /404',
    '',
    ...AI_BOTS.flatMap((b) => [`User-agent: ${b}`, 'Allow: /', '']),
    `Sitemap: ${new URL('/sitemap-index.xml', site).href}`,
    '',
  ].join('\n');
  return new Response(body, { headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
};
