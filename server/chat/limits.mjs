/**
 * Límites de uso en memoria (un solo proceso en Railway).
 *  - Diario por visitante (hash de IP + navegador) y por IP (redes compartidas / CGNAT).
 *  - Ráfaga por minuto, concurrencia global y por visitante.
 *  - Tope global diario de mensajes y de tokens (cortacircuitos de costos).
 * Privacidad: las claves son HMAC con una sal aleatoria que cambia cada día y
 * nunca se escribe en disco; al cambiar el día se descartan todos los contadores.
 */
import { createHmac, randomBytes } from 'node:crypto';

export class Limiter {
  constructor(cfg, now = () => Date.now()) {
    this.cfg = cfg;
    this.now = now;
    this.fmt = new Intl.DateTimeFormat('en-CA', { timeZone: cfg.timeZone, year: 'numeric', month: '2-digit', day: '2-digit' });
    this.active = 0;
    this.activeByVisitor = new Set();
    this.#reset();
  }

  #today() { return this.fmt.format(this.now()); }

  #reset() {
    this.day = this.#today();
    this.salt = randomBytes(32);
    this.visitors = new Map(); // clave → { count, minute: [timestamps] }
    this.ips = new Map();      // clave → count
    this.globalCount = 0;
    this.tokens = 0;
  }

  #roll() { if (this.#today() !== this.day) this.#reset(); }

  /** Claves seudónimas del día: no permiten recuperar la IP. */
  keys(ip, userAgent) {
    this.#roll();
    const h = (s) => createHmac('sha256', this.salt).update(s).digest('base64url').slice(0, 22);
    return { visitor: h(`v|${ip}|${String(userAgent || '').slice(0, 200)}`), ip: h(`i|${ip}`) };
  }

  remaining(keys) {
    this.#roll();
    const used = this.visitors.get(keys.visitor)?.count || 0;
    return Math.max(0, this.cfg.dailyLimit - used);
  }

  /** Comprueba y reserva un mensaje. Devuelve { ok, code, retryAfter, remaining }. */
  take(keys) {
    this.#roll();
    const t = this.now();
    const v = this.visitors.get(keys.visitor) || { count: 0, minute: [] };
    v.minute = v.minute.filter((ts) => t - ts < 60_000);
    const ipCount = this.ips.get(keys.ip) || 0;

    if (this.globalCount >= this.cfg.globalDailyLimit || this.tokens >= this.cfg.dailyTokenBudget) {
      return { ok: false, code: 'service_quota', retryAfter: this.#secondsToMidnight() };
    }
    if (v.count >= this.cfg.dailyLimit || ipCount >= this.cfg.ipDailyLimit) {
      return { ok: false, code: 'daily_limit', retryAfter: this.#secondsToMidnight(), remaining: 0 };
    }
    if (v.minute.length >= this.cfg.burstPerMinute) {
      return { ok: false, code: 'slow_down', retryAfter: Math.ceil((60_000 - (t - v.minute[0])) / 1000) };
    }
    if (this.activeByVisitor.has(keys.visitor)) return { ok: false, code: 'in_progress', retryAfter: 2 };
    if (this.active >= this.cfg.maxConcurrent) return { ok: false, code: 'busy', retryAfter: 5 };

    v.count += 1;
    v.minute.push(t);
    this.visitors.set(keys.visitor, v);
    this.ips.set(keys.ip, ipCount + 1);
    this.globalCount += 1;
    this.active += 1;
    this.activeByVisitor.add(keys.visitor);
    this.#prune();
    return { ok: true, remaining: Math.max(0, this.cfg.dailyLimit - v.count) };
  }

  /** Libera la reserva; con refund=true devuelve el mensaje (falló por causas ajenas al usuario). */
  release(keys, { refund = false, tokens = 0 } = {}) {
    this.active = Math.max(0, this.active - 1);
    this.activeByVisitor.delete(keys.visitor);
    this.tokens += Math.max(0, tokens | 0);
    if (!refund) return;
    const v = this.visitors.get(keys.visitor);
    if (v && v.count > 0) v.count -= 1;
    const ip = this.ips.get(keys.ip);
    if (ip) this.ips.set(keys.ip, ip - 1);
    this.globalCount = Math.max(0, this.globalCount - 1);
  }

  stats() {
    this.#roll();
    return { day: this.day, messages: this.globalCount, tokens: this.tokens, visitors: this.visitors.size, active: this.active };
  }

  #secondsToMidnight() {
    const parts = new Intl.DateTimeFormat('en-GB', { timeZone: this.cfg.timeZone, hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23' })
      .formatToParts(this.now()).reduce((o, p) => ({ ...o, [p.type]: Number(p.value) }), {});
    return Math.max(60, 86_400 - (parts.hour * 3600 + parts.minute * 60 + parts.second));
  }

  #prune() {
    if (this.visitors.size <= 100_000) return; // tope de memoria ante ataques con muchas IPs
    const drop = [...this.visitors.keys()].slice(0, 20_000);
    for (const k of drop) this.visitors.delete(k);
  }
}
