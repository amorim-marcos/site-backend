"use strict";

/**
 * Rate limit em memória (janela fixa) por IP e global da rota.
 * A instância do PM2 é única; o contador zera no reinício, o que é aceitável.
 * Complementa o WAF, não o substitui.
 */

const GLOBAL_WINDOW_MS = 60 * 60 * 1000;
const PRUNE_THRESHOLD = 5000;

function createRateLimiter({ now = () => Date.now() } = {}) {
  const buckets = new Map();
  let global = { count: 0, resetAt: 0 };

  function prune(current) {
    if (buckets.size < PRUNE_THRESHOLD) return;
    buckets.forEach((entry, key) => {
      if (current >= entry.resetAt) buckets.delete(key);
    });
  }

  /**
   * Registra uma tentativa. O IP é checado primeiro: um IP já bloqueado não
   * consome o teto global (evita que um único IP esgote o canal).
   *
   * @returns {{allowed: true} | {allowed: false, scope: 'ip'|'global', retryAfterSeconds: number}}
   */
  function hit(ip, { ipMax, ipWindowMs, globalMaxPerHour }) {
    const current = now();
    prune(current);

    const key = ip || "unknown";
    let entry = buckets.get(key);
    if (!entry || current >= entry.resetAt) {
      entry = { count: 0, resetAt: current + ipWindowMs };
    }
    entry.count += 1;
    buckets.set(key, entry);

    if (entry.count > ipMax) {
      return {
        allowed: false,
        scope: "ip",
        retryAfterSeconds: Math.max(1, Math.ceil((entry.resetAt - current) / 1000)),
      };
    }

    if (current >= global.resetAt) {
      global = { count: 0, resetAt: current + GLOBAL_WINDOW_MS };
    }
    global.count += 1;

    if (global.count > globalMaxPerHour) {
      return {
        allowed: false,
        scope: "global",
        retryAfterSeconds: Math.max(1, Math.ceil((global.resetAt - current) / 1000)),
      };
    }

    return { allowed: true };
  }

  function reset() {
    buckets.clear();
    global = { count: 0, resetAt: 0 };
  }

  return { hit, reset };
}

module.exports = { createRateLimiter, defaultLimiter: createRateLimiter() };
