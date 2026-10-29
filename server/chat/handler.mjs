/**
 * Endpoints del asistente:
 *   GET  /api/chat/status  → { enabled, limit, remaining }
 *   POST /api/chat         → stream SSE: meta · delta* · done | error
 * Sin estado entre peticiones salvo contadores de uso seudónimos en memoria.
 * No se registra el contenido de las conversaciones.
 */
import { loadConfig } from './config.mjs';
import { loadIndex } from './retrieval.mjs';
import { embedQuery, streamAnswer, UpstreamError } from './gemini.mjs';
import { Limiter } from './limits.mjs';
import { ChatError, parseChatBody, looksLikeInjection, signTurn } from './guard.mjs';
import { buildSystemInstruction, buildUserTurn, CANNED } from './prompt.mjs';

const json = (res, status, body, headers = {}) => {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', ...headers });
  res.end(JSON.stringify(body));
};

function readBody(req, max) {
  return new Promise((resolve, reject) => {
    let size = 0;
    const parts = [];
    req.on('data', (c) => {
      size += c.length;
      if (size > max) {
        // Se deja de acumular; el resto se descarta y la conexión se cierra tras responder 413
        req.removeAllListeners('data');
        req.resume();
        reject(new ChatError(413, 'too_large', 'La solicitud es demasiado grande.'));
        return;
      }
      parts.push(c);
    });
    req.on('end', () => resolve(Buffer.concat(parts).toString('utf8')));
    req.on('error', reject);
  });
}

export function createChat(env = process.env, deps = {}) {
  const cfg = loadConfig(env);
  const limiter = deps.limiter || new Limiter(cfg);
  let index = null;
  let reason = '';
  try {
    if (!cfg.enabled) reason = 'desactivado (CHAT_ENABLED=false)';
    else if (!cfg.apiKey) reason = 'falta GEMINI_API_KEY';
    else index = deps.index || loadIndex(cfg.kbPath, cfg.kbKey);
  } catch (err) {
    reason = err.message;
  }
  const system = index ? buildSystemInstruction(index.kb) : '';
  const ready = Boolean(index);
  console.log(ready
    ? `Asistente listo: ${index.size} fragmentos${index.hasEmbeddings ? ' + embeddings' : ' (solo léxico)'} · modelo ${cfg.model}`
    : `Asistente no disponible: ${reason}`);
  if (ready && cfg.ephemeralSecret) console.warn('CHAT_SECRET no definido: las conversaciones se invalidarán al reiniciar.');

  const clientIp = (req) => {
    const h = req.headers[cfg.ipHeader];
    const ip = (Array.isArray(h) ? h[0] : h || '').split(',')[0].trim();
    return ip || req.socket.remoteAddress || 'desconocida';
  };

  /** Defensa CSRF/abuso desde otros sitios: el navegador siempre envía Origin en un POST. */
  function checkOrigin(req) {
    const origin = req.headers.origin;
    const site = req.headers['sec-fetch-site'];
    if (site && site !== 'same-origin') return false;
    return typeof origin === 'string' && cfg.allowedOrigins.has(origin);
  }

  async function handleStatus(req, res) {
    const keys = limiter.keys(clientIp(req), req.headers['user-agent']);
    json(res, 200, { enabled: ready, limit: cfg.dailyLimit, remaining: ready ? limiter.remaining(keys) : 0, maxChars: cfg.maxMessageChars });
  }

  async function handleChat(req, res) {
    if (!ready) throw new ChatError(503, 'disabled', 'El asistente no está disponible en este momento.');
    if (!checkOrigin(req)) throw new ChatError(403, 'forbidden', 'Solicitud no permitida.');
    if (!String(req.headers['content-type'] || '').toLowerCase().startsWith('application/json')) {
      throw new ChatError(415, 'bad_request', 'Formato no admitido.');
    }
    let body;
    try { body = JSON.parse(await readBody(req, cfg.maxBodyBytes)); } catch (err) {
      if (err instanceof ChatError) throw err;
      throw new ChatError(400, 'bad_request', 'Solicitud no válida.');
    }
    const input = parseChatBody(body, cfg);

    const keys = limiter.keys(clientIp(req), req.headers['user-agent']);
    const slot = limiter.take(keys);
    if (!slot.ok) {
      const messages = {
        daily_limit: `Llegaste al límite de ${cfg.dailyLimit} preguntas de hoy. Vuelve mañana o pide el libro para leerlo completo.`,
        slow_down: 'Vas muy rápido. Espera unos segundos antes de la siguiente pregunta.',
        in_progress: 'Espera a que termine la respuesta anterior.',
        busy: 'Hay muchas personas usando el asistente. Inténtalo de nuevo en unos segundos.',
        service_quota: 'El asistente alcanzó su capacidad de hoy. Vuelve mañana.',
      };
      throw new ChatError(429, slot.code, messages[slot.code], { retryAfter: slot.retryAfter, remaining: slot.remaining });
    }

    // A partir de aquí la respuesta es un stream SSE
    const abort = new AbortController();
    res.on('close', () => { if (!res.writableFinished) abort.abort(new Error('cliente desconectado')); });
    res.writeHead(200, {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-store, no-transform',
      'X-Accel-Buffering': 'no',
      Connection: 'keep-alive',
    });
    const send = (event, data) => { if (!res.writableEnded) res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`); };
    const heartbeat = setInterval(() => { if (!res.writableEnded) res.write(': ·\n\n'); }, 15_000);

    const started = Date.now();
    let answer = '';
    let tokens = 0;
    let refund = false;
    let outcome = 'ok';
    try {
      if (looksLikeInjection(input.message)) {
        outcome = 'guard';
        answer = CANNED.offTopic;
        send('meta', { sources: [], remaining: slot.remaining });
        send('delta', { t: answer });
      } else {
        const queryVec = index.hasEmbeddings ? await embedQuery(cfg, input.message, abort.signal) : null;
        // La consulta incluye el turno anterior del lector para resolver preguntas de seguimiento («¿y eso cómo se cobra?»)
        const lastUser = input.history.filter((t) => t.role === 'user').at(-1)?.text || '';
        const { chunks } = index.search(`${lastUser}\n${input.message}`, cfg.topK, queryVec);
        const sources = [...new Map(chunks.filter((c) => c.ch > 0).map((c) => [c.ch, index.chapters.get(c.ch)])).values()]
          .slice(0, 4).map((c) => ({ n: c.n, title: c.title, slug: c.slug }));
        send('meta', { sources, remaining: slot.remaining });

        const contents = [
          ...input.history.map((t) => ({ role: t.role, parts: [{ text: t.text }] })),
          { role: 'user', parts: [{ text: buildUserTurn(input.message, chunks, index.chapters) }] },
        ];
        for await (const evt of streamAnswer(cfg, { system, contents, signal: abort.signal })) {
          if (evt.type === 'text') {
            answer += evt.text;
            send('delta', { t: evt.text });
          } else if (evt.type === 'end') {
            tokens = evt.usage?.totalTokenCount || 0;
            if (String(evt.finishReason || '').startsWith('BLOCKED') || evt.finishReason === 'SAFETY' || evt.finishReason === 'PROHIBITED_CONTENT') {
              outcome = 'blocked';
              if (!answer.trim()) { answer = CANNED.blocked; send('delta', { t: answer }); }
            } else if (!answer.trim()) {
              outcome = 'empty';
              answer = CANNED.empty;
              send('delta', { t: answer });
            }
          }
        }
      }
      // Firma de la respuesta: el navegador la devuelve con el historial y así se verifica su autenticidad
      send('done', { sig: signTurn(cfg.secret, input.sid, input.index + 1, answer), remaining: slot.remaining });
    } catch (err) {
      refund = true;
      outcome = abort.signal.aborted ? 'aborted' : 'error';
      if (!abort.signal.aborted) {
        const quota = err instanceof UpstreamError && err.status === 429;
        if (err instanceof UpstreamError && !quota) console.error(`chat upstream ${err.status}: ${String(err.detail).slice(0, 200)}`);
        send('error', {
          code: quota ? 'upstream_busy' : 'upstream',
          message: quota ? 'El servicio de IA está saturado. Inténtalo en un minuto.' : 'No pude generar la respuesta. Inténtalo de nuevo.',
        });
      }
    } finally {
      clearInterval(heartbeat);
      limiter.release(keys, { refund, tokens });
      res.end();
      // Registro operativo mínimo: sin texto, sin IP.
      console.log(`chat ${outcome} ${Date.now() - started}ms tokens=${tokens}`);
    }
  }

  return {
    ready,
    cfg,
    limiter,
    /** Devuelve true si atendió la ruta. */
    async handle(req, res, pathname) {
      if (!pathname.startsWith('/api/')) return false;
      try {
        if (pathname === '/api/chat/status' && req.method === 'GET') await handleStatus(req, res);
        else if (pathname === '/api/chat' && req.method === 'POST') await handleChat(req, res);
        else if (pathname === '/api/chat' || pathname === '/api/chat/status') json(res, 405, { code: 'method', message: 'Método no permitido.' }, { Allow: pathname === '/api/chat' ? 'POST' : 'GET' });
        else json(res, 404, { code: 'not_found', message: 'No encontrado.' });
      } catch (err) {
        if (res.headersSent) { res.end(); return true; }
        if (err instanceof ChatError) {
          const headers = err.extra.retryAfter ? { 'Retry-After': String(err.extra.retryAfter) } : {};
          if (err.status === 413) { headers.Connection = 'close'; res.on('finish', () => req.destroy()); }
          json(res, err.status, { code: err.code, message: err.message, ...err.extra }, headers);
        } else {
          console.error('chat error interno', err?.message);
          json(res, 500, { code: 'internal', message: 'Error interno.' });
        }
      }
      return true;
    },
  };
}
