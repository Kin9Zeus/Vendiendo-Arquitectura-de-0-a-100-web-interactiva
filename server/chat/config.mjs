/**
 * Configuración del asistente del libro. Todo se lee de variables de entorno
 * (Railway → Variables, o .env en local). Valores por defecto conservadores.
 */
import { randomBytes } from 'node:crypto';
import { fileURLToPath } from 'node:url';

const int = (value, fallback, min, max) => {
  const n = Number.parseInt(value ?? '', 10);
  return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : fallback;
};

const hostsOf = (list) => (list || '').split(',').map((h) => h.trim()).filter(Boolean);

export function loadConfig(env = process.env) {
  const isProd = env.NODE_ENV === 'production';
  const origins = new Set();
  try { if (env.SITE_URL) origins.add(new URL(env.SITE_URL).origin); } catch { /* URL inválida */ }
  for (const h of hostsOf(env.ALLOW_HOSTS)) origins.add(`https://${h}`);
  if (!isProd) {
    for (const p of ['4321', '8080', env.PORT || '8080']) {
      origins.add(`http://localhost:${p}`);
      origins.add(`http://127.0.0.1:${p}`);
    }
  }

  let secret = env.CHAT_SECRET || '';
  const ephemeralSecret = secret.length < 32;
  if (ephemeralSecret) secret = randomBytes(32).toString('base64url'); // válido solo mientras viva el proceso

  return Object.freeze({
    isProd,
    enabled: env.CHAT_ENABLED !== 'false',
    // Gemini
    apiKey: env.GEMINI_API_KEY || '',
    apiBase: (env.GEMINI_API_BASE || 'https://generativelanguage.googleapis.com/v1beta').replace(/\/$/, ''),
    model: env.GEMINI_MODEL || 'gemini-3.5-flash-lite',
    fallbackModel: env.GEMINI_FALLBACK_MODEL || 'gemini-3.1-flash-lite',
    embedModel: env.GEMINI_EMBED_MODEL || 'gemini-embedding-001',
    thinkingLevel: env.GEMINI_THINKING_LEVEL || 'minimal',
    maxOutputTokens: int(env.CHAT_MAX_OUTPUT_TOKENS, 900, 128, 4096),
    upstreamTimeoutMs: int(env.CHAT_UPSTREAM_TIMEOUT_MS, 45_000, 5_000, 120_000),
    // Base de conocimiento cifrada
    kbPath: env.KB_PATH || fileURLToPath(new URL('../data/kb.enc', import.meta.url)),
    kbKey: env.KB_KEY || '',
    topK: int(env.CHAT_TOP_K, 7, 2, 15),
    // Conversación
    secret,
    ephemeralSecret,
    maxMessageChars: int(env.CHAT_MAX_MESSAGE_CHARS, 600, 50, 2000),
    maxTurns: int(env.CHAT_MAX_TURNS, 12, 2, 40),
    maxHistoryChars: int(env.CHAT_MAX_HISTORY_CHARS, 9_000, 1_000, 40_000),
    maxBodyBytes: int(env.CHAT_MAX_BODY_BYTES, 48_000, 4_000, 200_000),
    // Límites de uso
    dailyLimit: int(env.CHAT_DAILY_LIMIT, 25, 1, 1000),            // por visitante (IP + navegador)
    ipDailyLimit: int(env.CHAT_IP_DAILY_LIMIT, 120, 1, 10_000),     // por IP (redes compartidas)
    burstPerMinute: int(env.CHAT_BURST_PER_MINUTE, 6, 1, 60),
    globalDailyLimit: int(env.CHAT_GLOBAL_DAILY_LIMIT, 3000, 1, 1_000_000),
    dailyTokenBudget: int(env.CHAT_DAILY_TOKEN_BUDGET, 30_000_000, 10_000, 2_000_000_000),
    maxConcurrent: int(env.CHAT_MAX_CONCURRENT, 12, 1, 500),
    timeZone: env.CHAT_TIME_ZONE || 'America/Bogota',
    // Red
    allowedOrigins: origins,
    ipHeader: (env.CLIENT_IP_HEADER || 'x-real-ip').toLowerCase(),
  });
}
