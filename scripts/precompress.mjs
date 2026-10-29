// Precomprime dist/ en brotli y gzip para que sirv los entregue sin coste de CPU.
import { readdir, readFile, writeFile, stat } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { brotliCompressSync, gzipSync, constants } from 'node:zlib';

const DIST = fileURLToPath(new URL('../dist/', import.meta.url));
const COMPRESSIBLE = /\.(html|css|js|mjs|json|xml|txt|svg|webmanifest|ico)$/;

async function* walk(dir) {
  for (const e of await readdir(dir, { withFileTypes: true })) {
    const p = join(dir, e.name);
    if (e.isDirectory()) yield* walk(p);
    else yield p;
  }
}

let n = 0, before = 0, after = 0;
for await (const file of walk(DIST)) {
  if (!COMPRESSIBLE.test(file)) continue;
  const { size } = await stat(file);
  if (size < 512) continue;
  const buf = await readFile(file);
  const br = brotliCompressSync(buf, { params: { [constants.BROTLI_PARAM_QUALITY]: 11, [constants.BROTLI_PARAM_SIZE_HINT]: size } });
  await writeFile(`${file}.br`, br);
  await writeFile(`${file}.gz`, gzipSync(buf, { level: 9 }));
  n++; before += size; after += br.length;
}
console.log(`precompress: ${n} archivos · ${(before / 1024).toFixed(0)} kB → ${(after / 1024).toFixed(0)} kB (brotli)`);
