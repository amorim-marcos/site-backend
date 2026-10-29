"use strict";

const crypto = require("crypto");

/**
 * Token do formulário: prova que o formulário foi aberto há pelo menos N
 * segundos e há no máximo M minutos. Formato: `<ts>.<nonce>.<assinatura>`,
 * assinatura = HMAC-SHA256(secret, "<ts>.<nonce>"). Não é de uso único
 * (reenvio legítimo não pode falhar); o abuso por reuso é contido pelo rate limit.
 */

function sign(secret, payload) {
  return crypto.createHmac("sha256", secret).update(payload).digest("hex");
}

function issue(secret, now = Date.now()) {
  const nonce = crypto.randomBytes(8).toString("hex");
  const payload = `${now}.${nonce}`;
  return `${payload}.${sign(secret, payload)}`;
}

/**
 * @returns {{ok: true} | {ok: false, reason: 'MISSING'|'MALFORMED'|'BAD_SIGNATURE'|'TOO_FAST'|'EXPIRED'}}
 */
function verify(token, secret, { now = Date.now(), minAgeSeconds, maxAgeMs } = {}) {
  if (typeof token !== "string" || token === "") return { ok: false, reason: "MISSING" };

  const parts = token.split(".");
  if (parts.length !== 3) return { ok: false, reason: "MALFORMED" };

  const [issuedAt, nonce, signature] = parts;
  if (!/^\d+$/.test(issuedAt) || !/^[0-9a-f]+$/.test(nonce) || !/^[0-9a-f]{64}$/.test(signature)) {
    return { ok: false, reason: "MALFORMED" };
  }

  const expected = Buffer.from(sign(secret, `${issuedAt}.${nonce}`), "hex");
  const received = Buffer.from(signature, "hex");
  if (expected.length !== received.length || !crypto.timingSafeEqual(expected, received)) {
    return { ok: false, reason: "BAD_SIGNATURE" };
  }

  const age = now - Number(issuedAt);
  if (age < minAgeSeconds * 1000) return { ok: false, reason: "TOO_FAST" };
  if (age > maxAgeMs) return { ok: false, reason: "EXPIRED" };

  return { ok: true };
}

module.exports = { issue, verify };
