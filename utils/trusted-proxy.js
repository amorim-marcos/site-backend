"use strict";

/**
 * IP do cliente atrás de proxy.
 *
 * Com `server.proxy` ligado o Koa lê o `X-Forwarded-For` e usa o PRIMEIRO IP da
 * lista. Proxies como a ALB acrescentam o IP de quem se conectou à lista que o
 * cliente enviou, então o primeiro IP é controlado pelo atacante e o rate limit
 * por IP seria forjável. `maxIpsCount` restringe a lista aos N últimos IPs, que
 * são os acrescentados por proxies confiáveis.
 *
 * PROXY_TRUSTED_HOPS = quantos proxies confiáveis acrescentam ao header
 * (padrão 1: só a ALB; CloudFront + ALB = 2).
 *
 * @returns {number} saltos aplicados (0 se o proxy está desligado)
 * @throws se PROXY_TRUSTED_HOPS for inválido, para não deixar o IP forjável em silêncio
 */
function applyTrustedProxyHops(app, env = process.env) {
  if (!app || !app.proxy) return 0;

  const hops = Number(env.PROXY_TRUSTED_HOPS || "1");
  if (!Number.isInteger(hops) || hops < 1) {
    throw new Error(`PROXY_TRUSTED_HOPS inválido: "${env.PROXY_TRUSTED_HOPS}" (use um inteiro >= 1)`);
  }

  app.maxIpsCount = hops;
  return hops;
}

module.exports = { applyTrustedProxyHops };
