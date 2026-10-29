/**
 * Construye la base de conocimiento cifrada del asistente.
 *   npm run kb:build   (extrae el PDF con kb_extract.py y luego ejecuta este script)
 *
 * - Lee .kb/chunks.json (texto del libro, solo local) y el mapa de capítulos de src/data/book.ts.
 * - Si hay GEMINI_API_KEY, añade embeddings (gemini-embedding-001, 768 dimensiones) para búsqueda semántica.
 * - Cifra todo con AES-256-GCM (KB_KEY) → server/data/kb.enc, que sí puede ir al repositorio.
 * - Si no existe .env, lo crea con KB_KEY y CHAT_SECRET aleatorios.
 * Requiere Node ≥ 22.18 (ejecuta TypeScript de book.ts sin compilar).
 */
import { readFileSync, writeFileSync, existsSync, mkdirSync, appendFileSync } from 'node:fs';
import { randomBytes } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { encryptKB, decryptKB, f32ToB64 } from '../server/chat/kb-crypto.mjs';
import { embedDocuments } from '../server/chat/gemini.mjs';
import { loadConfig } from '../server/chat/config.mjs';
import { BOOK, CHAPTERS } from '../src/data/book.ts';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const CHUNKS = `${ROOT}.kb/chunks.json`;
const OUT = `${ROOT}server/data/kb.enc`;
const ENV = `${ROOT}.env`;

// 1. Secretos locales
const env = existsSync(ENV) ? readFileSync(ENV, 'utf8') : '';
const ensure = (name, value) => {
  if (process.env[name] || new RegExp(`^${name}=.+`, 'm').test(env)) return;
  appendFileSync(ENV, `${env && !env.endsWith('\n') ? '\n' : ''}${name}=${value}\n`);
  process.env[name] = value;
  console.log(`· ${name} generado en .env (cópialo a las variables de Railway)`);
};
ensure('KB_KEY', randomBytes(32).toString('base64'));
ensure('CHAT_SECRET', randomBytes(32).toString('base64url'));
if (!process.env.KB_KEY) process.env.KB_KEY = readFileSync(ENV, 'utf8').match(/^KB_KEY=(.+)$/m)[1].trim();

// 2. Fragmentos + mapa del libro
if (!existsSync(CHUNKS)) {
  console.error('Falta .kb/chunks.json. Ejecuta primero: python scripts/kb_extract.py');
  process.exit(1);
}
const chunks = JSON.parse(readFileSync(CHUNKS, 'utf8'));
const chapters = [
  { n: 0, page: 9, title: 'Preliminares: prólogo, prefacio, agradecimientos y nota del autor', slug: '', summary: 'Prólogo de Luis Felipe Cuartas Correa, prefacio, agradecimientos y la nota del autor sobre su infancia construyendo maquetas y el origen del libro.' },
  ...CHAPTERS.map((c) => ({ n: c.n, page: c.page, title: c.title, slug: c.slug, summary: c.summary, byline: c.byline || '' })),
];
const titleOf = new Map(chapters.map((c) => [c.n, c.title]));

// 3. Embeddings (opcional)
const cfg = loadConfig(process.env);
let withEmbeddings = false;
if (cfg.apiKey) {
  try {
    console.log(`· Calculando embeddings con ${cfg.embedModel}…`);
    const vectors = await embedDocuments(cfg, chunks.map((c) => ({ text: c.text, title: titleOf.get(c.ch) })));
    vectors.forEach((v, i) => { chunks[i].emb = f32ToB64(v); });
    withEmbeddings = true;
    process.stdout.write('\n');
  } catch (err) {
    console.warn(`! Sin embeddings (${err.message}). Se usará solo búsqueda léxica.`);
  }
} else {
  console.log('· Sin GEMINI_API_KEY: base solo con búsqueda léxica (vuelve a ejecutar cuando tengas la clave).');
}

// 4. Cifrado y verificación de ida y vuelta
const kb = {
  version: 1,
  createdAt: new Date().toISOString(),
  embedModel: withEmbeddings ? cfg.embedModel : null,
  dims: withEmbeddings ? 768 : 0,
  book: { title: BOOK.title, author: BOOK.author, collection: BOOK.collection, volume: BOOK.volume, edition: BOOK.edition, publisher: BOOK.publisher },
  chapters,
  chunks,
};
mkdirSync(`${ROOT}server/data`, { recursive: true });
const blob = encryptKB(kb, process.env.KB_KEY);
const check = decryptKB(blob, process.env.KB_KEY);
if (check.chunks.length !== chunks.length) throw new Error('La verificación del cifrado falló');
writeFileSync(OUT, blob);
console.log(`✓ server/data/kb.enc · ${chunks.length} fragmentos · ${(blob.length / 1024).toFixed(0)} kB · embeddings: ${withEmbeddings ? 'sí' : 'no'}`);
