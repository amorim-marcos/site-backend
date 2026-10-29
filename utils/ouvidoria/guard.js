"use strict";

const fs = require("fs");

const { getConfig: defaultGetConfig, missingRouteVariables, TOKEN_HEADER } = require("./config");
const { OuvidoriaError, errorBody } = require("./errors");
const { parseMultipart } = require("./multipart");
const { ensureTempDir } = require("./tempDir");
const { defaultLimiter } = require("./rateLimiter");
const formToken = require("./formToken");

/**
 * Guard da rota de envio da Ouvidoria. Roda ANTES do parser do Strapi
 * (que aceita até 250 MB), para rejeitar sem ler o corpo.
 *
 * Ordem: rota ativa -> configuração -> token do formulário -> rate limit ->
 * multipart -> Content-Length (obrigatório, sem chunked, <= limite) -> teto de
 * envios simultâneos -> leitura do multipart. O token vem antes do rate limit
 * para que requisições sem token válido não consumam a cota dos usuários.
 *
 * Depois de validar, o próprio guard lê o multipart (ver `multipart.js`), num
 * diretório temporário dedicado e restrito, e entrega o resultado ao handler em
 * `ctx.state.ouvidoriaForm`. O parser global do Strapi não tem como pular uma
 * rota, então o guard troca o Content-Type da requisição antes de seguir: sem
 * `multipart`, o koa-body não tenta ler um corpo que já foi consumido. O parser
 * global e a configuração dele continuam intactos para todas as outras rotas.
 *
 * O rate limit limita a taxa, não a simultaneidade: sem o teto, uma rajada
 * poderia manter dezenas de uploads de 50 MB abertos ao mesmo tempo no disco
 * temporário e no processo que também atende o site.
 */

const BUSY_RETRY_SECONDS = 30;

// Prazo para receber o corpo inteiro; evita que um envio lento ocupe uma vaga indefinidamente.
const PARSE_TIMEOUT_MS = 10 * 60 * 1000;

// Tipo que o parser global enxerga depois que o guard consumiu o multipart.
const PARSED_CONTENT_TYPE = "application/x-ouvidoria-parsed";

function removeFiles(form) {
  const files = (form && form.files) || {};
  Object.keys(files).forEach((key) => {
    [].concat(files[key]).forEach((file) => {
      if (file && file.path) fs.unlink(file.path, () => {});
    });
  });
}

// koa-router é case-insensitive; o guard também precisa ser.
const SEND_PATH = /^\/contact-channels\/[^/]+\/sendOuvidoria\/?$/i;

function safeDecode(path) {
  try {
    return decodeURIComponent(path);
  } catch (e) {
    return path;
  }
}

function matches(path) {
  return SEND_PATH.test(path) || SEND_PATH.test(safeDecode(path));
}

function reject(ctx, status, code, message, extra) {
  ctx.status = status;
  ctx.body = errorBody(status, code, message, extra);
  // Não deixar o cliente continuar enviando um corpo que não será lido.
  ctx.set("Connection", "close");
}

function createGuard({
  getConfig = defaultGetConfig,
  limiter = defaultLimiter,
  now = () => Date.now(),
  log = console,
  parse = parseMultipart,
  ensureTemp = ensureTempDir,
  parseTimeoutMs = PARSE_TIMEOUT_MS,
} = {}) {
  let warnedMisconfigured = false;
  let inFlight = 0;

  return async function ouvidoriaGuard(ctx, next) {
    if (ctx.method !== "POST" || !matches(ctx.path)) {
      return next();
    }

    const config = getConfig();

    if (!config.enabled) {
      return reject(ctx, 404, "OUVIDORIA_DISABLED", "Not Found");
    }

    const missing = missingRouteVariables(config);
    if (missing.length > 0) {
      if (!warnedMisconfigured) {
        warnedMisconfigured = true;
        log.error(`[OUVIDORIA][GUARD] configuração incompleta, rota bloqueada. Faltam: ${missing.join(", ")}`);
      }
      return reject(ctx, 503, "OUVIDORIA_MISCONFIGURED", "Service unavailable");
    }

    const tokenCheck = formToken.verify(ctx.get(TOKEN_HEADER), config.formToken.secret, {
      now: now(),
      minAgeSeconds: config.formToken.minAgeSeconds,
      maxAgeMs: config.formToken.maxAgeMs,
    });
    if (!tokenCheck.ok) {
      if (tokenCheck.reason === "TOO_FAST") {
        ctx.set("Retry-After", String(config.formToken.minAgeSeconds));
        return reject(ctx, 429, "FORM_TOO_FAST", "Aguarde alguns segundos e envie novamente.", {
          retryAfter: config.formToken.minAgeSeconds,
        });
      }
      const code = tokenCheck.reason === "EXPIRED" ? "FORM_TOKEN_EXPIRED" : "FORM_TOKEN_INVALID";
      log.warn(`[OUVIDORIA][GUARD] token ${tokenCheck.reason} ip=${ctx.request.ip}`);
      return reject(ctx, 403, code, "Formulário inválido ou expirado. Recarregue e tente novamente.");
    }

    const decision = limiter.hit(ctx.request.ip, config.rate);
    if (!decision.allowed) {
      ctx.set("Retry-After", String(decision.retryAfterSeconds));
      log.warn(`[OUVIDORIA][GUARD] rate limit (${decision.scope}) ip=${ctx.request.ip}`);
      return reject(ctx, 429, "RATE_LIMITED", "Muitas tentativas. Tente novamente mais tarde.", {
        retryAfter: decision.retryAfterSeconds,
      });
    }

    if (!ctx.request.is("multipart/form-data")) {
      return reject(ctx, 415, "UNSUPPORTED_MEDIA_TYPE", "O envio deve ser multipart/form-data");
    }

    if (ctx.get("transfer-encoding")) {
      return reject(ctx, 411, "LENGTH_REQUIRED", "Content-Length é obrigatório");
    }
    const length = ctx.get("content-length");
    if (!/^\d+$/.test(length)) {
      return reject(ctx, 411, "LENGTH_REQUIRED", "Content-Length é obrigatório");
    }
    if (Number(length) > config.maxBodyBytes) {
      return reject(ctx, 413, "BODY_TOO_LARGE", "Corpo da requisição acima do limite");
    }

    if (inFlight >= config.temp.maxConcurrentUploads) {
      ctx.set("Retry-After", String(BUSY_RETRY_SECONDS));
      log.warn(`[OUVIDORIA][GUARD] teto de envios simultâneos atingido (${inFlight}) ip=${ctx.request.ip}`);
      return reject(ctx, 503, "BUSY", "Serviço ocupado. Tente novamente em instantes.", {
        retryAfter: BUSY_RETRY_SECONDS,
      });
    }

    inFlight += 1;
    try {
      const temp = ensureTemp(config.temp.dir);
      if (!temp.ok) {
        log.error(`[OUVIDORIA][GUARD] diretório temporário indisponível (${temp.error})`);
        return reject(ctx, 503, "STORAGE_UNAVAILABLE", "Não foi possível receber o arquivo agora");
      }

      let timer;
      try {
        const parsing = parse(ctx.req, {
          uploadDir: config.temp.dir,
          maxBodyBytes: config.maxBodyBytes,
        });
        const timeout = new Promise((resolve, reject) => {
          timer = setTimeout(() => {
            // Derrubar a conexão faz o parser falhar e apagar os parciais.
            ctx.req.destroy();
            reject(new OuvidoriaError(408, "UPLOAD_TIMEOUT", "Tempo esgotado para receber o arquivo"));
          }, parseTimeoutMs);
        });
        parsing.catch(() => {});
        ctx.state.ouvidoriaForm = await Promise.race([parsing, timeout]);
      } catch (error) {
        if (!(error instanceof OuvidoriaError)) throw error;
        return reject(ctx, error.status, error.code, error.message);
      } finally {
        clearTimeout(timer);
      }

      ctx.req.headers["content-type"] = PARSED_CONTENT_TYPE;
      return await next();
    } finally {
      // Os temporários só existem durante a request, tenha o handler rodado ou não
      // (permissão negada na rota, erro antes do handler, falha inesperada).
      removeFiles(ctx.state && ctx.state.ouvidoriaForm);
      inFlight -= 1;
    }
  };
}

module.exports = { createGuard, matches, SEND_PATH };
