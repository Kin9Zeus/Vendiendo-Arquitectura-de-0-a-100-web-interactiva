/**
 * Genera los QR del libro impreso a partir de server/qr-links.mjs.
 *   npm run qr                → print/qr/ con SVG (vector, para imprenta), PNG 1200 px,
 *                               indice.csv y hoja-de-prueba.html (imprimir y escanear antes del tiraje).
 *   QR_HOST=otro.dominio npm run qr  → otro dominio corto.
 *
 * Corrección de errores Q (25 %): lee aunque el papel se raye o se manche.
 * Margen de 4 módulos (zona de silencio) incluido en el archivo: no recortarlo.
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import QRCode from 'qrcode';
import { QR_LINKS, QR_HOST_DEFAULT } from '../server/qr-links.mjs';

const HOST = process.env.QR_HOST || QR_HOST_DEFAULT;
const OUT = fileURLToPath(new URL('../print/qr/', import.meta.url));
mkdirSync(OUT, { recursive: true });

const book = readFileSync(new URL('../src/data/book.ts', import.meta.url), 'utf8');
const TITLES = Object.fromEntries([...book.matchAll(/n: (\d+), page: (\d+), slug: '[^']+', title: '([^']+)'/g)]
  .map((m) => [`va/${m[1].padStart(2, '0')}`, { title: m[3], page: m[2] }]));

const opts = { errorCorrectionLevel: 'Q', margin: 4, color: { dark: '#000000', light: '#ffffff' } };
const rows = [['codigo', 'url_del_qr', 'texto_bajo_el_qr', 'destino_actual', 'capitulo', 'pagina', 'archivo_svg', 'version_qr']];
const cards = [];

for (const [code, target] of Object.entries(QR_LINKS)) {
  const url = `https://${HOST}/${code}`;
  const file = code === 'va' ? 'va-libro' : code.replace('/', '-');
  const qr = QRCode.create(url, opts);
  const svg = await QRCode.toString(url, { ...opts, type: 'svg' });
  writeFileSync(`${OUT}${file}.svg`, svg);
  await QRCode.toFile(`${OUT}${file}.png`, url, { ...opts, width: 1200 });
  const meta = TITLES[code];
  const label = `${HOST}/${code}`;
  rows.push([code, url, label, target, meta?.title ?? 'Libro completo', meta?.page ?? '', `${file}.svg`, String(qr.version)]);
  cards.push(`<figure><div class="qr">${svg}</div><figcaption><b>${label}</b><span>${meta ? `Cap. ${code.slice(3)} · pág. ${meta.page}` : 'Libro completo'}</span></figcaption></figure>`);
}

const csv = rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n');
writeFileSync(`${OUT}indice.csv`, '﻿' + csv + '\n');

writeFileSync(`${OUT}hoja-de-prueba.html`, `<!doctype html>
<html lang="es"><head><meta charset="utf-8"><title>Hoja de prueba de QR · ${HOST}</title>
<style>
  @page { size: A4; margin: 12mm; }
  body { font: 10pt/1.3 system-ui, sans-serif; color: #000; margin: 0; }
  h1 { font-size: 13pt; margin: 0 0 2mm; } p { margin: 0 0 6mm; }
  .grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 8mm 6mm; }
  figure { margin: 0; break-inside: avoid; }
  .qr svg { display: block; width: 25mm; height: 25mm; }
  .small .qr svg { width: 20mm; height: 20mm; }
  figcaption { display: grid; margin-top: 1.5mm; } figcaption b { font-size: 8.5pt; } figcaption span { color: #555; font-size: 8pt; }
</style></head><body>
<h1>Hoja de prueba · QR del libro</h1>
<p>Imprime esta hoja en el papel del libro y escanea cada código con varios celulares (iPhone y Android), con buena y con poca luz. Primero a 25 mm, luego a 20 mm (mínimo recomendado).</p>
<div class="grid">${cards.join('')}</div>
<h1 style="margin-top:10mm">Tamaño mínimo (20 mm)</h1>
<div class="grid small">${cards.join('')}</div>
</body></html>
`);

console.log(`${rows.length - 1} QR en print/qr/ para https://${HOST}/… (versión QR ${[...new Set(rows.slice(1).map((r) => r[7]))].join('/')}, corrección Q)`);
