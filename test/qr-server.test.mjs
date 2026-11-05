/**
 * Redirecciones de los QR contra el servidor real (server.mjs) en modo producción.
 * Necesita dist/ (npm run build); si no existe, la prueba se omite.
 */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { request } from 'node:http';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const HAS_DIST = existsSync(`${ROOT}dist/index.html`);
const PORT = 18000 + Math.floor(Math.random() * 1000);
let child;

const get = (host, path) => new Promise((resolve, reject) => {
  const req = request({ host: '127.0.0.1', port: PORT, path, headers: { Host: host, 'X-Forwarded-Proto': 'https' } }, (res) => {
    res.resume();
    resolve({ status: res.statusCode, location: res.headers.location, cache: res.headers['cache-control'] });
  });
  req.on('error', reject);
  req.end();
});

before(async () => {
  if (!HAS_DIST) return;
  child = spawn(process.execPath, ['server.mjs'], {
    cwd: ROOT,
    env: { ...process.env, NODE_ENV: 'production', PORT: String(PORT), SITE_URL: 'https://www.uvalibros.com', QR_HOST: 'q.uvalibros.com', CHAT_ENABLED: 'false', GEMINI_API_KEY: '' },
    stdio: ['ignore', 'pipe', 'inherit'],
  });
  await new Promise((resolve, reject) => {
    child.stdout.on('data', (d) => { if (String(d).includes('Servidor listo')) resolve(); });
    child.on('exit', (c) => reject(new Error(`server.mjs salió con ${c}`)));
  });
});
after(() => child?.kill());

test('QR del capítulo 6 → página del capítulo con el chat, sin caché', { skip: !HAS_DIST }, async () => {
  const r = await get('q.uvalibros.com', '/va/06');
  assert.equal(r.status, 302);
  assert.equal(r.location, 'https://www.uvalibros.com/capitulos/como-cotizar-un-diseno?desde=qr');
  assert.equal(r.cache, 'no-store');
});

test('mayúsculas y sin cero también funcionan', { skip: !HAS_DIST }, async () => {
  const r = await get('Q.UVALIBROS.COM', '/VA/6');
  assert.equal(r.location, 'https://www.uvalibros.com/capitulos/como-cotizar-un-diseno?desde=qr');
});

test('ruta /q/ en el dominio principal (respaldo)', { skip: !HAS_DIST }, async () => {
  const r = await get('www.uvalibros.com', '/q/va/19');
  assert.equal(r.status, 302);
  assert.equal(r.location, 'https://www.uvalibros.com/capitulos/conclusiones-finales?desde=qr');
});

test('código dañado o raíz del dominio corto → inicio del libro', { skip: !HAS_DIST }, async () => {
  assert.equal((await get('q.uvalibros.com', '/va/77')).location, 'https://www.uvalibros.com/');
  assert.equal((await get('q.uvalibros.com', '/')).location, 'https://www.uvalibros.com/');
});

test('todos los códigos llevan a una página que el servidor sirve (200)', { skip: !HAS_DIST }, async () => {
  const { QR_LINKS } = await import('../server/qr-links.mjs');
  for (const code of Object.keys(QR_LINKS)) {
    const r = await get('q.uvalibros.com', `/${code}`);
    const to = new URL(r.location);
    const page = await get(to.host, to.pathname + to.search);
    assert.equal(page.status, 200, `${code} → ${r.location} respondió ${page.status}`);
  }
});

test('el healthcheck responde también en el dominio corto', { skip: !HAS_DIST }, async () => {
  assert.equal((await get('q.uvalibros.com', '/healthz')).status, 200);
});
