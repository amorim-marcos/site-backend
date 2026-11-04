"use strict";

/**
 * Validação e normalização dos campos de texto do formulário da Ouvidoria.
 * Limites seguem a especificação do SE: texto curto 255, mensagem 4000.
 */

const SHORT_MAX = 255;
const MESSAGE_MAX = 4000;

const UF_CODES = [
  "AC", "AL", "AP", "AM", "BA", "CE", "DF", "ES", "GO", "MA", "MT", "MS", "MG", "PA",
  "PB", "PR", "PE", "PI", "RJ", "RN", "RS", "RO", "RR", "SC", "SP", "SE", "TO",
];

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_PATTERN = /^[0-9()+\-.\s]{8,30}$/;
const PHONE_MIN_DIGITS = 8;

function isValidPhone(phone) {
  return PHONE_PATTERN.test(phone) && phone.replace(/\D/g, "").length >= PHONE_MIN_DIGITS;
}

// Campos exigidos hoje no formulário do Fale Conosco. Em modo anônimo
// (OUVIDORIA_ALLOW_ANONYMOUS) nenhum é obrigatório.
const REQUIRED_WHEN_IDENTIFIED = ["name", "email", "phone", "city", "state"];

function clean(value, { multiline = false } = {}) {
  if (value === undefined || value === null) return "";
  let text = Array.isArray(value) ? String(value[0] ?? "") : String(value);
  // Remove caracteres de controle (mantém quebras de linha na mensagem).
  text = multiline
    ? text.replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, "")
    : text.replace(/[\u0000-\u001f\u007f]/g, " ");
  return text.trim();
}

/**
 * @param {object} body campos recebidos no multipart
 * @param {{allowAnonymous: boolean}} config
 * @returns {{ok: boolean, values: object, errors: Array<{field: string, code: string}>}}
 */
function validateFields(body, config) {
  const source = body || {};
  const values = {
    name: clean(source.name),
    email: clean(source.email),
    phone: clean(source.phone),
    city: clean(source.city),
    state: clean(source.state).toUpperCase(),
    company: clean(source.company),
    message: clean(source.message, { multiline: true }),
  };

  const errors = [];

  if (!config.allowAnonymous) {
    REQUIRED_WHEN_IDENTIFIED.forEach((field) => {
      if (values[field] === "") errors.push({ field, code: "REQUIRED" });
    });
  }

  ["name", "email", "phone", "city", "company"].forEach((field) => {
    if (values[field].length > SHORT_MAX) errors.push({ field, code: "TOO_LONG" });
  });
  if (values.message.length > MESSAGE_MAX) errors.push({ field: "message", code: "TOO_LONG" });

  if (values.email !== "" && !EMAIL_PATTERN.test(values.email)) {
    errors.push({ field: "email", code: "INVALID" });
  }
  if (values.phone !== "" && !isValidPhone(values.phone)) {
    errors.push({ field: "phone", code: "INVALID" });
  }
  if (values.state !== "" && !UF_CODES.includes(values.state)) {
    errors.push({ field: "state", code: "INVALID" });
  }

  return { ok: errors.length === 0, values, errors };
}

/** Título do workflow no SE: e-mail (como no spec) ou texto genérico se anônimo. */
function workflowTitle(values, now = new Date()) {
  if (values.email) return values.email;
  return `Denúncia anônima ${now.toISOString()}`;
}

module.exports = { validateFields, workflowTitle, UF_CODES, SHORT_MAX, MESSAGE_MAX };
