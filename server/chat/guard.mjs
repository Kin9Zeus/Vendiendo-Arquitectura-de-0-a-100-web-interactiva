/**
 * Validación de entrada, minimización de datos personales y detección básica
 * de intentos de manipulación. Todo lo que llega del navegador es no confiable.
 */
import { createHmac, timingSafeEqual } from 'node:crypto';

export class ChatError extends Error {
  constructor(status, code, message, extra = {}) {
    super(message);
    this.status = status;
    this.code = code;
    this.extra = extra;
  }
}

const CONTROL = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F​-‏‪-‮⁦-⁩﻿]/g;

/** Limpia texto: sin caracteres de control ni marcas bidi invisibles, saltos acotados. */
export function cleanText(s) {
  return String(s).normalize('NFC').replace(CONTROL, '').replace(/\r\n?/g, '\n').replace(/\n{3,}/g, '\n\n').replace(/[ \t]{3,}/g, '  ').trim();
}

/** Solo texto: rechaza adjuntos codificados, imágenes en base64 o bloques binarios. */
export function looksLikeFile(s) {
  return /data:[a-z]+\/[a-z0-9.+-]+;base64,/i.test(s)
    || /<\s*(img|svg|script|iframe|object|embed)\b/i.test(s)
    || /[A-Za-z0-9+/=]{180,}/.test(s);
}

/** Minimización: los datos personales no son necesarios para hablar del libro, no se envían a la IA. */
export function redactPII(s) {
  return s
    .replace(/[\w.+-]+@[\w-]+\.[\w.-]+/g, '[correo omitido]')
    .replace(/\b(?:\d{4}[ -]?){3}\d{1,4}\b/g, '[número omitido]')                    // tarjetas
    .replace(/\+\d{1,3}[\s-]?\(?\d{1,4}\)?(?:[\s-]?\d{2,4}){2,4}\b/g, '[teléfono omitido]') // internacionales
    .replace(/\b3\d{2}[\s-]?\d{3}[\s-]?\d{4}\b/g, '[teléfono omitido]');             // celulares de Colombia
  // Las cifras con puntos ($18.000.000, 10.000 %) son del libro y se conservan.
}

const INJECTION = [
  /ignor[ae]\w*\s+(?:todas?\s+)?(?:las\s+|tus\s+|the\s+|all\s+|previous\s+|anteriores\s+)*(?:instrucci|reglas|indicaciones|instructions|rules)/i,
  /olvida\w*\s+(?:todas?\s+)?(?:tus|las)\s+(?:instrucci|reglas)/i,
  /(?:system|developer)\s*(?:prompt|message|mode)|prompt\s+del\s+sistema|modo\s+desarrollador|instrucciones\s+(?:del\s+sistema|internas|ocultas)/i,
  /(?:revela|muestra|imprime|repite|copia|reveal|print|show)\w*\s+(?:tus|las|your|the)?\s*(?:instrucciones|reglas|prompt|configuraci|instructions)/i,
  /\b(?:jailbreak|DAN|do anything now)\b/i,
  /(?:act[uú]a|finge|haz\s+de\s+cuenta|pretend|act)\s+(?:como|que\s+eres|as|to\s+be)\s+(?!un\s+lector|lector)/i,
  /<\/?\s*(?:system|instrucciones|fragmentos|sistema)\s*>/i,
];

export const looksLikeInjection = (s) => INJECTION.some((re) => re.test(s));

// ---------- firma del historial ----------
const mac = (secret, sid, idx, text) => createHmac('sha256', secret).update(`${sid}\u0000${idx}\u0000${text}`).digest('base64url');

export const signTurn = (secret, sid, idx, text) => mac(secret, sid, idx, text);

export function verifyTurn(secret, sid, idx, text, sig) {
  if (typeof sig !== 'string' || sig.length !== 43) return false;
  const a = Buffer.from(mac(secret, sid, idx, text));
  const b = Buffer.from(sig);
  return a.length === b.length && timingSafeEqual(a, b);
}

/**
 * Valida el cuerpo { sid, message, history[] }.
 * Las respuestas previas del asistente deben venir firmadas por este servidor:
 * así nadie puede inventar «lo que el asistente ya dijo» para manipularlo.
 */
export function parseChatBody(body, cfg) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) throw new ChatError(400, 'bad_request', 'Solicitud no válida.');
  const { sid, message, history = [] } = body;
  if (typeof sid !== 'string' || !/^[A-Za-z0-9_-]{16,64}$/.test(sid)) throw new ChatError(400, 'bad_request', 'Sesión no válida. Recarga la página.');
  if (typeof message !== 'string') throw new ChatError(400, 'bad_request', 'Escribe tu pregunta como texto.');
  const text = cleanText(message);
  if (text.length < 2) throw new ChatError(400, 'empty', 'Escribe una pregunta.');
  if (text.length > cfg.maxMessageChars) throw new ChatError(413, 'too_long', `Tu pregunta supera los ${cfg.maxMessageChars} caracteres. Hazla más corta.`);
  if (looksLikeFile(text)) throw new ChatError(415, 'text_only', 'El asistente solo acepta preguntas en texto, sin archivos ni imágenes.');
  if (!Array.isArray(history) || history.length > cfg.maxTurns * 2 + 2) throw new ChatError(400, 'bad_request', 'La conversación es demasiado larga. Empieza una nueva.');

  const turns = [];
  for (let i = 0; i < history.length; i++) {
    const t = history[i];
    if (!t || typeof t !== 'object' || typeof t.text !== 'string' || (t.role !== 'user' && t.role !== 'model')) {
      throw new ChatError(400, 'bad_request', 'Conversación no válida. Empieza una nueva.');
    }
    const expected = i % 2 === 0 ? 'user' : 'model'; // estrictamente alternado, empezando por el lector
    if (t.role !== expected) throw new ChatError(400, 'bad_request', 'Conversación no válida. Empieza una nueva.');
    if (t.role === 'model' && !verifyTurn(cfg.secret, sid, i, t.text, t.sig)) {
      throw new ChatError(409, 'history_tampered', 'La conversación no se pudo verificar. Empieza una nueva.');
    }
    turns.push({ role: t.role, text: t.role === 'user' ? redactPII(cleanText(t.text)).slice(0, cfg.maxMessageChars) : t.text });
  }
  if (turns.length % 2 !== 0) throw new ChatError(400, 'bad_request', 'Conversación no válida. Empieza una nueva.');

  // Ventana deslizante: últimos turnos y tope de caracteres (control de costo)
  let window = turns.slice(-cfg.maxTurns);
  while (window.length && window.reduce((n, t) => n + t.text.length, 0) > cfg.maxHistoryChars) window = window.slice(2);

  return { sid, message: redactPII(text), history: window, index: history.length };
}
