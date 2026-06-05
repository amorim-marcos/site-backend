'use strict';

const requests = new Map();

const WINDOW_MS = 10 * 60 * 1000; // 10 minutes
const MAX_REQUESTS = 5;

module.exports = async (ctx, next) => {
  const ip = ctx.request.ip;
  const now = Date.now();

  const entry = requests.get(ip) || { count: 0, resetAt: now + WINDOW_MS };

  if (now > entry.resetAt) {
    entry.count = 0;
    entry.resetAt = now + WINDOW_MS;
  }

  entry.count += 1;
  requests.set(ip, entry);

  if (entry.count > MAX_REQUESTS) {
    const retryAfter = Math.ceil((entry.resetAt - now) / 1000);
    ctx.set('Retry-After', retryAfter);
    return ctx.tooManyRequests(`Limite de envios atingido. Tente novamente em ${retryAfter} segundos.`);
  }

  await next();
};
