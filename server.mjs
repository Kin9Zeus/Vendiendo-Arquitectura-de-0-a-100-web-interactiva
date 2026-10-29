/**
 * Servidor de producción (Railway). Sirve dist/ con:
 *  - cabeceras de seguridad (HSTS, CSP complementaria, COOP/CORP, Permissions-Policy…)
 *  - caché inmutable para /_astro/*, revalidación para HTML
 *  - brotli/gzip precomprimidos (scripts/precompress.mjs)
 *  - redirecciones canónicas (HTTPS, host, sin barra final, sin .html)
 *  - 404 personalizada y /healthz para el healthcheck
 * Sin estado, sin cookies, sin dependencias aparte de sirv.
 */
import { createServer } from 'node:http';
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join, dirname } from 'node:path';
import sirv from 'sirv';

const ROOT = dirname(fileURLToPath(import.meta.url));
const DIST = join(ROOT, 'dist');
const PORT = Number(process.env.PORT) || 8080;
const HOST = process.env.HOST || '0.0.0.0';
const IS_PROD = process.env.NODE_ENV === 'production';
// Host canónico, p. ej. www.vendiendoarquitectura.com. Vacío = no forzar host.
const CANONICAL_HOST = (() => {
  try { return process.env.SITE_URL ? new URL(process.env.SITE_URL).host : ''; } catch { return ''; }
})();
// Hosts que pueden servir sin redirigir (dominio *.up.railway.app para pruebas).
const ALLOW_HOSTS = (process.env.ALLOW_HOSTS || '').split(',').map((h) => h.trim()).filter(Boolean);

if (!existsSync(join(DIST, 'index.html'))) {
  console.error('dist/ no existe. Ejecuta «npm run build» antes de «npm start».');
  process.exit(1);
}
const NOT_FOUND = readFileSync(join(DIST, '404.html'));
const NOT_FOUND_BR = existsSync(join(DIST, '404.html.br')) ? readFileSync(join(DIST, '404.html.br')) : null;

// La CSP de scripts/estilos (con hashes) la emite Astro en <meta>. Aquí van las
// directivas que una <meta> no puede expresar. Sin script-src para no intersectar.
const CSP = [
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "object-src 'none'",
  "form-action 'self'",
  IS_PROD ? 'upgrade-insecure-requests' : '',
].filter(Boolean).join('; ');

const SECURITY_HEADERS = {
  'Content-Security-Policy': CSP,
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Permissions-Policy': 'accelerometer=(), camera=(), geolocation=(), gyroscope=(), magnetometer=(), microphone=(), payment=(), usb=(), interest-cohort=(), browsing-topics=()',
  'Cross-Origin-Opener-Policy': 'same-origin',
  'Cross-Origin-Resource-Policy': 'same-origin',
  'X-DNS-Prefetch-Control': 'off',
  'X-Permitted-Cross-Domain-Policies': 'none',
  'Origin-Agent-Cluster': '?1',
};
if (IS_PROD) SECURITY_HEADERS['Strict-Transport-Security'] = 'max-age=63072000; includeSubDomains; preload';

const assets = sirv(DIST, {
  dev: false,
  etag: true,
  brotli: true,
  gzip: true,
  extensions: ['html'],
  dotfiles: false,
  setHeaders(res, pathname) {
    if (pathname.startsWith('/_astro/')) {
      res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
    } else if (pathname.endsWith('.html') || pathname === '/') {
      res.setHeader('Cache-Control', 'public, max-age=0, must-revalidate');
    } else if (/\.(png|jpe?g|webp|avif|ico|svg|woff2?)$/.test(pathname)) {
      res.setHeader('Cache-Control', 'public, max-age=604800, stale-while-revalidate=86400');
    } else {
      res.setHeader('Cache-Control', 'public, max-age=3600');
    }
  },
});
// security.txt vive en /.well-known (dotfiles desactivado a propósito para todo lo demás)
const wellKnown = sirv(join(DIST, '.well-known'), { dev: false, etag: true });

function redirect(res, location, code = 301) {
  res.writeHead(code, { Location: location, 'Cache-Control': 'public, max-age=3600' });
  res.end();
}

function notFound(req, res) {
  res.statusCode = 404;
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  const br = NOT_FOUND_BR && /\bbr\b/.test(req.headers['accept-encoding'] || '');
  if (br) { res.setHeader('Content-Encoding', 'br'); res.setHeader('Vary', 'Accept-Encoding'); }
  res.end(req.method === 'HEAD' ? undefined : br ? NOT_FOUND_BR : NOT_FOUND);
}

const server = createServer((req, res) => {
  const started = Date.now();
  for (const [k, v] of Object.entries(SECURITY_HEADERS)) res.setHeader(k, v);
  res.on('finish', () => {
    if (IS_PROD) console.log(`${req.method} ${req.url?.split('?')[0]} ${res.statusCode} ${Date.now() - started}ms`);
  });

  if (req.method !== 'GET' && req.method !== 'HEAD') {
    res.writeHead(405, { Allow: 'GET, HEAD' });
    return res.end();
  }

  let url;
  try { url = new URL(req.url || '/', 'http://localhost'); } catch { res.writeHead(400); return res.end(); }

  if (url.pathname === '/healthz') {
    res.writeHead(200, { 'Content-Type': 'text/plain', 'Cache-Control': 'no-store' });
    return res.end('ok');
  }

  // HTTPS y host canónico (Railway termina TLS y envía x-forwarded-proto)
  const host = String(req.headers['x-forwarded-host'] || req.headers.host || '');
  const proto = String(req.headers['x-forwarded-proto'] || 'http').split(',')[0].trim();
  if (IS_PROD && CANONICAL_HOST && !ALLOW_HOSTS.includes(host)) {
    if (host !== CANONICAL_HOST || proto !== 'https') {
      return redirect(res, `https://${CANONICAL_HOST}${url.pathname}${url.search}`, 301);
    }
  }

  // URLs limpias: sin .html, sin index, sin barra final
  let p = url.pathname;
  if (p.length > 1 && p.endsWith('/')) return redirect(res, p.replace(/\/+$/, '') + url.search);
  if (p.endsWith('/index.html')) return redirect(res, p.slice(0, -'index.html'.length) || '/');
  if (p.endsWith('.html')) return redirect(res, p.slice(0, -5) + url.search);
  if (p === '/404') return notFound(req, res);

  if (p.startsWith('/.well-known/')) {
    req.url = p.slice('/.well-known'.length);
    return wellKnown(req, res, () => notFound(req, res));
  }
  return assets(req, res, () => notFound(req, res));
});

server.keepAliveTimeout = 65_000;
server.headersTimeout = 66_000;
server.requestTimeout = 30_000;
server.listen(PORT, HOST, () => console.log(`Servidor listo en http://${HOST}:${PORT}`));

const shutdown = () => server.close(() => process.exit(0));
process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
