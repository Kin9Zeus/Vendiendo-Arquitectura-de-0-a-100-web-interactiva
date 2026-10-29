/**
 * Recuperación híbrida sobre los fragmentos del libro:
 *  - BM25 léxico en español (siempre disponible, sin coste).
 *  - Similitud coseno con embeddings de Gemini (si la base los incluye).
 * Ambos rankings se combinan con Reciprocal Rank Fusion.
 */
import { readFileSync, existsSync } from 'node:fs';
import { decryptKB, b64ToF32 } from './kb-crypto.mjs';

const STOP = new Set(`a al algo algun alguna algunas alguno algunos ante antes aquel aquella aquello aqui asi aun aunque bajo bien cada casi como con contra cual cuales cuando de del desde donde dos el ella ellas ello ellos en entre era eran eres es esa esas ese eso esos esta estaba estado estan estar estas este esto estos fue fueron ha habia han hasta hay la las le les lo los mas me mi mis mucho muy nada ni no nos nosotros o os otra otras otro otros para pero poco por porque que quien se ser si sido sin sobre son su sus tambien tan tanto te tiene tienen todo todos tu tus un una unas uno unos usted ustedes ya yo libro capitulo dice habla explica explicame sobre cual cuales seria puedo puede debo debe quiero hola gracias favor`.split(/\s+/));

export const normalize = (s) => String(s).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

/** Tokens con raíz aproximada (prefijo de 6 letras: robusto para la morfología del español). */
export function tokenize(text) {
  const out = [];
  for (const w of normalize(text).match(/[a-z0-9ñ]+/g) || []) {
    if (w.length < 3 || STOP.has(w)) continue;
    out.push(w.length > 6 ? w.slice(0, 6) : w);
  }
  return out;
}

export function buildBM25(docs) {
  const k1 = 1.4, b = 0.72;
  const tf = docs.map((d) => {
    const m = new Map();
    for (const t of tokenize(d)) m.set(t, (m.get(t) || 0) + 1);
    return m;
  });
  const len = tf.map((m) => [...m.values()].reduce((a, c) => a + c, 0));
  const avg = len.reduce((a, c) => a + c, 0) / Math.max(1, len.length);
  const df = new Map();
  for (const m of tf) for (const t of m.keys()) df.set(t, (df.get(t) || 0) + 1);
  const N = docs.length;
  const idf = (t) => Math.log(1 + (N - (df.get(t) || 0) + 0.5) / ((df.get(t) || 0) + 0.5));
  return (query) => {
    const q = [...new Set(tokenize(query))];
    return tf.map((m, i) => {
      let s = 0;
      for (const t of q) {
        const f = m.get(t);
        if (f) s += idf(t) * ((f * (k1 + 1)) / (f + k1 * (1 - b + (b * len[i]) / avg)));
      }
      return s;
    });
  };
}

const cosine = (a, b) => {
  let s = 0;
  for (let i = 0; i < a.length; i++) s += a[i] * b[i];
  return s; // vectores normalizados
};

export function createIndex(kb) {
  const chunks = kb.chunks.map((c) => ({ ...c, vec: c.emb ? b64ToF32(c.emb) : null, emb: undefined }));
  const chapters = new Map(kb.chapters.map((c) => [c.n, c]));
  const bm25 = buildBM25(chunks.map((c) => `${chapters.get(c.ch)?.title ?? ''} ${c.text}`));
  const hasEmbeddings = chunks.every((c) => c.vec);

  function rank(scores) {
    return scores.map((s, i) => [i, s]).filter(([, s]) => s > 0).sort((a, b) => b[1] - a[1]).map(([i]) => i);
  }

  return {
    kb,
    chapters,
    hasEmbeddings,
    size: chunks.length,
    /** Devuelve los k fragmentos más afines y la fuerza léxica de la coincidencia. */
    search(query, k, queryVec = null) {
      const lexical = bm25(query);
      const lexRank = rank(lexical);
      const fused = new Map();
      lexRank.slice(0, 40).forEach((i, r) => fused.set(i, (fused.get(i) || 0) + 1 / (60 + r)));
      if (queryVec && hasEmbeddings) {
        const semRank = rank(chunks.map((c) => cosine(queryVec, c.vec)));
        semRank.slice(0, 40).forEach((i, r) => fused.set(i, (fused.get(i) || 0) + 1 / (60 + r)));
      }
      const top = [...fused.entries()].sort((a, b) => b[1] - a[1]).slice(0, k).map(([i]) => chunks[i]);
      // Orden de lectura (capítulo, página) para que el modelo vea el contexto en secuencia
      top.sort((a, b) => a.ch - b.ch || a.page - b.page || a.id - b.id);
      return { chunks: top, lexicalMax: lexical.length ? Math.max(...lexical) : 0 };
    },
  };
}

export function loadIndex(path, key) {
  if (!key) throw new Error('Falta KB_KEY');
  if (!existsSync(path)) throw new Error(`No existe la base de conocimiento: ${path}`);
  return createIndex(decryptKB(readFileSync(path), key));
}
