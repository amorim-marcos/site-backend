"use strict";

/**
 * Erro de validação com status HTTP e código estável (o frontend usa o código
 * para escolher a mensagem em cada idioma).
 */
class OuvidoriaError extends Error {
  constructor(status, code, message, details) {
    super(message || code);
    this.name = "OuvidoriaError";
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

function errorBody(status, code, message, extra = {}) {
  return { statusCode: status, error: code, code, message: message || code, ...extra };
}

module.exports = { OuvidoriaError, errorBody };
