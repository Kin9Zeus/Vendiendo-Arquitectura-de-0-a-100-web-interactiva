/**
 * Los QR del libro impreso no pueden romperse nunca.
 * PRINTED es la lista de códigos que ya están (o estarán) en papel: solo se añaden líneas.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { QR_LINKS, normalizeCode, resolveQr } from '../server/qr-links.mjs';

const PRINTED = [
  'va',
  'va/01', 'va/02', 'va/03', 'va/04', 'va/05', 'va/06', 'va/07', 'va/08', 'va/09', 'va/10',
  'va/11', 'va/12', 'va/13', 'va/14', 'va/15', 'va/16', 'va/17', 'va/18', 'va/19',
];

const book = readFileSync(new URL('../src/data/book.ts', import.meta.url), 'utf8');
const SLUGS = new Set([...book.matchAll(/slug: '([^']+)'/g)].map((m) => m[1]));

test('ningún código impreso desaparece', () => {
  for (const code of PRINTED) assert.ok(QR_LINKS[code], `falta el código impreso «${code}»`);
});

test('cada código apunta a una página que existe en el sitio', () => {
  for (const [code, target] of Object.entries(QR_LINKS)) {
    if (target === '/') continue;
    const m = target.match(/^\/capitulos\/([a-z0-9-]+)$/);
    assert.ok(m, `destino con formato inesperado: ${code} → ${target}`);
    assert.ok(SLUGS.has(m[1]), `${code} apunta a un capítulo que no existe: ${m[1]}`);
  }
});

test('el capítulo NN del QR es el capítulo NN del libro', () => {
  for (const m of book.matchAll(/n: (\d+), page: \d+, slug: '([^']+)'/g)) {
    const code = `va/${m[1].padStart(2, '0')}`;
    assert.equal(QR_LINKS[code], `/capitulos/${m[2]}`, code);
  }
});

test('normaliza lo que teclea o escanea la gente', () => {
  assert.equal(normalizeCode('/VA/06'), 'va/06');
  assert.equal(normalizeCode('/va/6/'), 'va/06');
  assert.equal(normalizeCode('/q/va/06'), 'va/06');
  assert.equal(normalizeCode('//va//06'), 'va/06');
});

test('dominio corto y ruta /q redirigen al capítulo con el chat', () => {
  const siteOrigin = 'https://www.uvalibros.com';
  assert.equal(
    resolveQr({ host: 'q.uvalibros.com', pathname: '/va/06', siteOrigin }),
    'https://www.uvalibros.com/capitulos/como-cotizar-un-diseno?desde=qr',
  );
  assert.equal(
    resolveQr({ host: 'www.uvalibros.com', pathname: '/q/va/17', siteOrigin }),
    'https://www.uvalibros.com/capitulos/facturar-no-es-ganar?desde=qr',
  );
  assert.equal(resolveQr({ host: 'q.uvalibros.com', pathname: '/va', siteOrigin }), 'https://www.uvalibros.com/');
});

test('un código desconocido lleva al inicio, nunca a un error', () => {
  assert.equal(resolveQr({ host: 'q.uvalibros.com', pathname: '/va/99', siteOrigin: 'https://x.co' }), 'https://x.co/');
  assert.equal(resolveQr({ host: 'q.uvalibros.com', pathname: '/', siteOrigin: 'https://x.co' }), 'https://x.co/');
});

test('en el dominio corto sin SITE_URL no hay bucle (destino absoluto)', () => {
  assert.match(resolveQr({ host: 'q.uvalibros.com', pathname: '/va/01' }), /^https:\/\/www\.uvalibros\.com\//);
});

test('las demás rutas del sitio no se tocan', () => {
  assert.equal(resolveQr({ host: 'www.uvalibros.com', pathname: '/capitulos/la-intuicion' }), null);
  assert.equal(resolveQr({ host: 'www.uvalibros.com', pathname: '/quienes' }), null);
});
