/**
 * Cliente mínimo de la API de Gemini (REST + SSE), sin SDK: menos dependencias,
 * control total de timeouts, cancelación y errores. La clave va en cabecera,
 * nunca en la URL (no aparece en registros de proxies).
 */

export class UpstreamError extends Error {
  constructor(status, detail, retryable) {
    super(`Gemini ${status}`);
    this.status = status;
    this.detail = detail;
    this.retryable = retryable;
  }
}

const SAFETY = [
  'HARM_CATEGORY_HARASSMENT',
  'HARM_CATEGORY_HATE_SPEECH',
  'HARM_CATEGORY_SEXUALLY_EXPLICIT',
  'HARM_CATEGORY_DANGEROUS_CONTENT',
].map((category) => ({ category, threshold: 'BLOCK_MEDIUM_AND_ABOVE' }));

function timeoutSignal(parent, ms) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(new Error('timeout')), ms);
  const onAbort = () => ctrl.abort(parent.reason);
  parent?.addEventListener('abort', onAbort, { once: true });
  return { signal: ctrl.signal, done: () => { clearTimeout(timer); parent?.removeEventListener('abort', onAbort); } };
}

async function post(cfg, path, body, signal) {
  const res = await fetch(`${cfg.apiBase}/${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-goog-api-key': cfg.apiKey },
    body: JSON.stringify(body),
    signal,
  });
  if (!res.ok) {
    let detail = '';
    try { detail = (await res.text()).slice(0, 600); } catch { /* sin cuerpo */ }
    throw new UpstreamError(res.status, detail, res.status === 429 || res.status >= 500 || res.status === 404);
  }
  return res;
}

const l2 = (v) => {
  let n = 0;
  for (const x of v) n += x * x;
  n = Math.sqrt(n) || 1;
  return Float32Array.from(v, (x) => x / n);
};

/** Embedding de la pregunta (normalizado). Devuelve null si algo falla: se usa solo BM25. */
export async function embedQuery(cfg, text, parentSignal, dims = 768) {
  if (!cfg.apiKey) return null;
  const t = timeoutSignal(parentSignal, 6_000);
  try {
    const res = await post(cfg, `models/${cfg.embedModel}:embedContent`, {
      model: `models/${cfg.embedModel}`,
      content: { parts: [{ text }] },
      taskType: 'RETRIEVAL_QUERY',
      outputDimensionality: dims,
    }, t.signal);
    const json = await res.json();
    const values = json?.embedding?.values || json?.embeddings?.[0]?.values;
    return Array.isArray(values) && values.length === dims ? l2(values) : null;
  } catch {
    return null;
  } finally {
    t.done();
  }
}

/** Embeddings por lotes para construir la base (se usa en scripts/kb-build.mjs). */
export async function embedDocuments(cfg, items, dims = 768) {
  const out = [];
  for (let i = 0; i < items.length; i += 64) {
    const batch = items.slice(i, i + 64);
    const res = await post(cfg, `models/${cfg.embedModel}:batchEmbedContents`, {
      requests: batch.map((it) => ({
        model: `models/${cfg.embedModel}`,
        content: { parts: [{ text: it.text }] },
        taskType: 'RETRIEVAL_DOCUMENT',
        title: it.title,
        outputDimensionality: dims,
      })),
    }, AbortSignal.timeout(60_000));
    const json = await res.json();
    for (const e of json.embeddings || []) out.push(l2(e.values));
    process.stdout.write(`  embeddings ${Math.min(i + 64, items.length)}/${items.length}\r`);
  }
  if (out.length !== items.length) throw new Error('La API devolvió un número inesperado de embeddings');
  return out;
}

/** Lee un stream SSE de Gemini y emite objetos JSON. */
async function* sseJson(body) {
  const decoder = new TextDecoder();
  let buffer = '';
  for await (const chunk of body) {
    buffer += decoder.decode(chunk, { stream: true });
    let idx;
    while ((idx = buffer.indexOf('\n')) >= 0) {
      const line = buffer.slice(0, idx).replace(/\r$/, '');
      buffer = buffer.slice(idx + 1);
      if (!line.startsWith('data:')) continue;
      const data = line.slice(5).trim();
      if (!data || data === '[DONE]') continue;
      try { yield JSON.parse(data); } catch { /* fragmento corrupto: se ignora */ }
    }
  }
}

function requestBody(cfg, system, contents, lean) {
  const generationConfig = { maxOutputTokens: cfg.maxOutputTokens, candidateCount: 1, responseMimeType: 'text/plain' };
  if (!lean && cfg.thinkingLevel) generationConfig.thinkingConfig = { thinkingLevel: cfg.thinkingLevel };
  return {
    systemInstruction: { parts: [{ text: system }] },
    contents,
    generationConfig,
    safetySettings: SAFETY,
    // Sin herramientas: el modelo no puede buscar en la web, ejecutar código ni generar archivos.
  };
}

/**
 * Genera la respuesta en streaming. Prueba el modelo principal y, si falla antes
 * de emitir texto (cuota, caída, modelo retirado), el de respaldo. Ante un 400
 * reintenta una vez con configuración mínima (por si un parámetro dejó de existir).
 */
export async function* streamAnswer(cfg, { system, contents, signal }) {
  const attempts = [
    { model: cfg.model, lean: false },
    { model: cfg.model, lean: true, onlyOn400: true },
    { model: cfg.fallbackModel, lean: false },
    { model: cfg.fallbackModel, lean: true, onlyOn400: true },
  ].filter((a, i, all) => a.model && all.findIndex((b) => b.model === a.model && b.lean === a.lean) === i);

  let lastError = null;
  for (const attempt of attempts) {
    if (attempt.onlyOn400 && lastError?.status !== 400) continue;
    if (!attempt.onlyOn400 && lastError && !lastError.retryable && lastError.status !== 400) break;
    const t = timeoutSignal(signal, cfg.upstreamTimeoutMs);
    let emitted = false;
    try {
      const res = await post(cfg, `models/${attempt.model}:streamGenerateContent?alt=sse`, requestBody(cfg, system, contents, attempt.lean), t.signal);
      let usage = null, finishReason = null, blocked = null;
      for await (const evt of sseJson(res.body)) {
        if (evt.promptFeedback?.blockReason) blocked = evt.promptFeedback.blockReason;
        const cand = evt.candidates?.[0];
        for (const part of cand?.content?.parts || []) {
          if (part.thought || typeof part.text !== 'string' || !part.text) continue; // nunca reenviar razonamiento interno
          emitted = true;
          yield { type: 'text', text: part.text };
        }
        if (cand?.finishReason) finishReason = cand.finishReason;
        if (evt.usageMetadata) usage = evt.usageMetadata;
      }
      yield { type: 'end', usage, finishReason: blocked ? `BLOCKED_${blocked}` : finishReason, model: attempt.model };
      return;
    } catch (err) {
      if (emitted || signal?.aborted) throw err; // ya hubo texto o el usuario canceló: no se reintenta
      lastError = err instanceof UpstreamError ? err : new UpstreamError(0, String(err?.message || err), true);
    } finally {
      t.done();
    }
  }
  throw lastError || new UpstreamError(0, 'sin intentos', false);
}
