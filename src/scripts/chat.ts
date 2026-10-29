/**
 * Asistente del libro (cliente). Se carga bajo demanda al abrir el panel.
 * - La conversación vive solo en memoria de esta pestaña: sin cookies, sin
 *   localStorage/sessionStorage, sin IndexedDB. Recargar o cerrar la borra.
 * - El texto del modelo se pinta con nodos DOM y textContent (nunca innerHTML).
 * - Cada respuesta del servidor llega firmada; se reenvía tal cual con el historial.
 */

type Turn = { role: 'user' | 'model'; text: string; sig?: string };
type Source = { n: number; title: string; slug: string };

const BASE = (import.meta.env.BASE_URL || '/').replace(/\/$/, '');
const MAX_TURNS = 24; // 12 intercambios por conversación (el servidor admite hasta 26)
const $ = <T extends Element = HTMLElement>(s: string, r: ParentNode = document) => r.querySelector<T>(s);

const dialog = $<HTMLDialogElement>('[data-chat]')!;
const log = $('[data-chat-log]', dialog)!;
const form = $<HTMLFormElement>('[data-chat-form]', dialog)!;
const input = $<HTMLTextAreaElement>('[data-chat-input]', dialog)!;
const sendBtn = $<HTMLButtonElement>('[data-chat-send]', dialog)!;
const stopBtn = $<HTMLButtonElement>('[data-chat-stop]', dialog)!;
const counter = $('[data-chat-count]', dialog)!;
const quotaEl = $('[data-chat-quota]', dialog)!;
const consent = $('[data-chat-consent]', dialog)!;
const accept = $<HTMLInputElement>('[data-chat-accept]', dialog)!;
const startBtn = $<HTMLButtonElement>('[data-chat-start]', dialog)!;
const suggestList = $('[data-chat-suggest]', dialog)!;

const state = {
  sid: randomId(),
  history: [] as Turn[],
  accepted: false,
  busy: false,
  enabled: true,
  maxChars: 600,
  remaining: null as number | null,
  limit: 25,
  controller: null as AbortController | null,
  pending: '' as string,
};

function randomId() {
  const a = new Uint8Array(18);
  crypto.getRandomValues(a);
  return btoa(String.fromCharCode(...a)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

/* ---------------- sugerencias según la página ---------------- */
function suggestions(): string[] {
  const ch = $('[data-ch-block]');
  if (ch?.dataset.chapterN) {
    const n = ch.dataset.chapterN;
    return [
      `Explícame las ideas clave del capítulo ${n}`,
      `¿Cómo se relaciona el capítulo ${n} con el resto del libro?`,
      `¿Qué error común advierte el capítulo ${n}?`,
    ];
  }
  return [
    '¿Cómo propone el libro cotizar un diseño para que lo aprueben?',
    '¿Qué es la escalera financiera de 0 a 100?',
    '¿Qué tipos de contrato de obra explica y cuándo conviene cada uno?',
    '¿Por qué dice que el anteproyecto le hace daño a la profesión?',
  ];
}

function renderSuggestions() {
  suggestList.replaceChildren(...suggestions().map((q) => {
    const li = document.createElement('li');
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'chat__chip';
    b.textContent = q;
    b.addEventListener('click', () => ask(q));
    li.append(b);
    return li;
  }));
}

/* ---------------- render seguro (subconjunto de markdown) ---------------- */
function inline(parent: HTMLElement, text: string) {
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  for (const p of parts) {
    if (!p) continue;
    if (p.startsWith('**') && p.endsWith('**') && p.length > 4) {
      const s = document.createElement('strong');
      s.textContent = p.slice(2, -2);
      parent.append(s);
    } else parent.append(document.createTextNode(p));
  }
}

function renderRich(el: HTMLElement, text: string) {
  el.replaceChildren();
  // Recorre línea a línea: las viñetas consecutivas forman una lista y el resto, párrafos
  let ul: HTMLUListElement | null = null;
  let p: HTMLParagraphElement | null = null;
  for (const raw of text.trim().split('\n')) {
    const line = raw.trimEnd();
    if (!line.trim()) { ul = null; p = null; continue; }
    if (/^\s*[-•*]\s+/.test(line)) {
      p = null;
      if (!ul) { ul = document.createElement('ul'); el.append(ul); }
      const li = document.createElement('li');
      inline(li, line.replace(/^\s*[-•*]\s+/, ''));
      ul.append(li);
    } else {
      ul = null;
      if (p) p.append(document.createElement('br'));
      else { p = document.createElement('p'); el.append(p); }
      inline(p, line.replace(/^#+\s*/, ''));
    }
  }
}

function bubble(role: 'user' | 'model' | 'notice', text = '') {
  const wrap = document.createElement('div');
  wrap.className = `chat__msg chat__msg--${role}`;
  const who = document.createElement('span');
  who.className = 'chat__who';
  who.textContent = role === 'user' ? 'Tú' : role === 'model' ? 'Asistente IA' : 'Aviso';
  const body = document.createElement('div');
  body.className = 'chat__body';
  if (role === 'model') renderRich(body, text);
  else body.textContent = text;
  wrap.append(who, body);
  log.append(wrap);
  scrollDown();
  return { wrap, body };
}

function scrollDown() {
  requestAnimationFrame(() => { log.scrollTop = log.scrollHeight; });
}

function sourcesRow(sources: Source[]) {
  if (!sources.length) return null;
  const row = document.createElement('p');
  row.className = 'chat__sources';
  row.append(document.createTextNode('Fuentes del libro: '));
  sources.forEach((s, i) => {
    if (i) row.append(document.createTextNode(' · '));
    const a = document.createElement('a');
    a.href = `${BASE}/capitulos/${encodeURIComponent(s.slug)}`;
    a.target = '_blank';
    a.rel = 'noopener';
    a.textContent = `Cap. ${String(s.n).padStart(2, '0')}`;
    a.title = s.title;
    row.append(a);
  });
  return row;
}

function notice(text: string, cta = false) {
  const { wrap } = bubble('notice', text);
  if (cta) {
    const a = document.createElement('a');
    a.className = 'btn chat__cta';
    a.href = dialog.dataset.wa || `${BASE}/#comprar`;
    a.target = '_blank';
    a.rel = 'noopener';
    a.textContent = 'Pedir el libro por WhatsApp';
    wrap.append(a);
  }
}

/* ---------------- estado de la interfaz ---------------- */
function updateQuota() {
  if (state.remaining == null) { quotaEl.textContent = ''; return; }
  quotaEl.textContent = state.remaining > 0
    ? `Te quedan ${state.remaining} de ${state.limit} preguntas hoy`
    : 'Sin preguntas disponibles hoy';
}

function updateCounter() {
  counter.textContent = `${input.value.length}/${state.maxChars}`;
  counter.classList.toggle('is-over', input.value.length > state.maxChars * 0.9);
}

function autosize() {
  input.style.height = 'auto';
  input.style.height = `${Math.min(input.scrollHeight, 160)}px`;
}

function setBusy(b: boolean) {
  state.busy = b;
  sendBtn.hidden = b;
  stopBtn.hidden = !b;
  input.readOnly = b;
  dialog.classList.toggle('is-busy', b);
  if (!b) setTimeout(() => input.focus({ preventScroll: true }), 0);
}

function lockConversation(msg: string, cta = false) {
  notice(msg, cta);
  input.disabled = true;
  sendBtn.disabled = true;
}

function resetConversation() {
  state.controller?.abort();
  state.sid = randomId();
  state.history = [];
  log.querySelectorAll('.chat__msg').forEach((n) => n.remove());
  input.disabled = false;
  sendBtn.disabled = false;
  input.value = '';
  updateCounter();
  autosize();
  setBusy(false);
}

/* ---------------- red ---------------- */
async function refreshStatus() {
  if (dialog.dataset.preview) {
    // Vista previa estática (GitHub Pages): no hay servidor para la IA
    state.enabled = false;
    consent.hidden = true;
    form.hidden = true;
    if (!log.querySelector('.chat__msg--notice')) notice('Esta es una vista previa del sitio: el asistente con IA funciona en la versión publicada. Mientras tanto, puedes pedir el libro por WhatsApp.', true);
    return;
  }
  try {
    const r = await fetch(`${BASE}/api/chat/status`, { headers: { Accept: 'application/json' }, cache: 'no-store' });
    if (!r.ok) throw new Error(String(r.status));
    const s = await r.json();
    state.enabled = Boolean(s.enabled);
    state.limit = s.limit ?? state.limit;
    state.remaining = s.remaining ?? null;
    state.maxChars = s.maxChars ?? state.maxChars;
    input.maxLength = state.maxChars;
  } catch {
    state.enabled = false;
  }
  updateQuota();
  updateCounter();
  if (!state.enabled) {
    consent.hidden = true;
    form.hidden = true;
    if (!log.querySelector('.chat__msg--notice')) notice('El asistente no está disponible en este momento. Vuelve más tarde o escríbenos por WhatsApp.', true);
  }
}

async function* readSSE(res: Response) {
  const reader = res.body!.getReader();
  const decoder = new TextDecoder();
  let buf = '';
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    buf += decoder.decode(value, { stream: true });
    let i: number;
    while ((i = buf.indexOf('\n\n')) >= 0) {
      const raw = buf.slice(0, i);
      buf = buf.slice(i + 2);
      let event = 'message', data = '';
      for (const line of raw.split('\n')) {
        if (line.startsWith('event:')) event = line.slice(6).trim();
        else if (line.startsWith('data:')) data += line.slice(5).trim();
      }
      if (data) { try { yield { event, data: JSON.parse(data) }; } catch { /* ignorar */ } }
    }
  }
}

async function ask(question: string) {
  const text = question.trim();
  if (!text || state.busy || !state.enabled) return;
  if (!state.accepted) { accept.focus(); return; }
  if (text.length > state.maxChars) { notice(`Tu pregunta supera los ${state.maxChars} caracteres.`); return; }
  if (state.history.length >= MAX_TURNS) {
    lockConversation('Esta conversación llegó a su máximo. Pulsa «Nueva conversación» para seguir preguntando.');
    return;
  }

  input.value = '';
  updateCounter();
  autosize();
  bubble('user', text);
  const { wrap, body } = bubble('model');
  wrap.classList.add('is-streaming');
  setBusy(true);

  const controller = new AbortController();
  state.controller = controller;
  let answer = '';
  let sig = '';
  let sources: Source[] = [];

  try {
    const res = await fetch(`${BASE}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'text/event-stream' },
      body: JSON.stringify({ sid: state.sid, message: text, history: state.history }),
      signal: controller.signal,
      cache: 'no-store',
    });

    if (!res.ok || !res.headers.get('content-type')?.includes('text/event-stream')) {
      let err: { code?: string; message?: string; remaining?: number } = {};
      try { err = await res.json(); } catch { /* sin cuerpo */ }
      wrap.remove();
      if (err.code === 'daily_limit') {
        state.remaining = 0;
        updateQuota();
        lockConversation(err.message || 'Llegaste al límite de hoy.', true);
      } else if (err.code === 'history_tampered') {
        notice(err.message || 'La conversación no se pudo verificar.');
        resetConversation();
      } else {
        notice(err.message || 'No pude enviar tu pregunta. Inténtalo de nuevo.');
        input.value = text;
        updateCounter();
      }
      return;
    }

    for await (const { event, data } of readSSE(res)) {
      if (event === 'meta') {
        sources = data.sources || [];
        if (typeof data.remaining === 'number') { state.remaining = data.remaining; updateQuota(); }
      } else if (event === 'delta') {
        answer += data.t || '';
        renderRich(body, answer);
        scrollDown();
      } else if (event === 'done') {
        sig = data.sig || '';
      } else if (event === 'error') {
        throw new Error(data.message || 'No pude generar la respuesta.');
      }
    }
    if (!sig) throw new Error('La respuesta llegó incompleta. Inténtalo de nuevo.');

    state.history.push({ role: 'user', text }, { role: 'model', text: answer, sig });
    const row = sourcesRow(sources);
    if (row) wrap.append(row);
    if (state.remaining === 0) lockConversation(`Esa fue tu última pregunta de hoy. Vuelve mañana o lee el libro completo.`, true);
  } catch (err) {
    const aborted = controller.signal.aborted;
    if (aborted && answer) {
      // Respuesta interrumpida: se muestra, pero no entra al historial (no está firmada)
      const em = document.createElement('p');
      em.className = 'chat__cut';
      em.textContent = 'Respuesta detenida.';
      wrap.append(em);
    } else {
      wrap.remove();
      if (!aborted) {
        notice(err instanceof Error && err.message && !/fetch|network/i.test(err.message) ? err.message : 'Se perdió la conexión. Revisa tu red e inténtalo de nuevo.');
        input.value = text;
        updateCounter();
      }
    }
  } finally {
    wrap.classList.remove('is-streaming');
    state.controller = null;
    setBusy(false);
    scrollDown();
  }
}

/* ---------------- eventos ---------------- */
accept.addEventListener('change', () => { startBtn.disabled = !accept.checked; });
startBtn.addEventListener('click', () => {
  if (!accept.checked) return;
  state.accepted = true;
  consent.hidden = true;
  form.hidden = false;
  dialog.classList.add('is-ready');
  input.focus();
  if (state.pending) { const q = state.pending; state.pending = ''; ask(q); }
});

form.addEventListener('submit', (e) => { e.preventDefault(); ask(input.value); });
input.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) { e.preventDefault(); ask(input.value); }
});
input.addEventListener('input', () => { updateCounter(); autosize(); });
// Solo texto: se bloquean archivos pegados o arrastrados
input.addEventListener('paste', (e) => {
  if (e.clipboardData && [...e.clipboardData.items].some((i) => i.kind === 'file')) {
    e.preventDefault();
    notice('El asistente solo acepta texto: no se pueden adjuntar imágenes ni archivos.');
  }
});
for (const ev of ['dragover', 'drop'] as const) dialog.addEventListener(ev, (e) => e.preventDefault());

stopBtn.addEventListener('click', () => state.controller?.abort());
$('[data-chat-reset]', dialog)!.addEventListener('click', () => {
  if (state.history.length && !confirm('¿Empezar una conversación nueva? La actual se borrará.')) return;
  resetConversation();
});
$('[data-chat-close]', dialog)!.addEventListener('click', () => dialog.close());
dialog.addEventListener('click', (e) => { if (e.target === dialog) dialog.close(); }); // clic en el fondo
dialog.addEventListener('close', () => {
  state.controller?.abort();
  window.dispatchEvent(new CustomEvent('chat:toggle', { detail: false }));
  document.querySelector<HTMLElement>('[data-chat-open]')?.focus({ preventScroll: true });
});

renderSuggestions();

/** API pública para main.ts */
export async function openChat(question?: string) {
  if (!dialog.open) {
    dialog.showModal();
    window.dispatchEvent(new CustomEvent('chat:toggle', { detail: true }));
    await refreshStatus();
  }
  if (question) {
    if (state.accepted) ask(question);
    else { state.pending = question; accept.focus(); }
  } else if (state.accepted) input.focus();
  else accept.focus();
}
