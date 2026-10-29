"use strict";

const crypto = require("crypto");
const fs = require("fs");

const {
  FLOW,
  FILE_FIELD,
  HONEYPOT_FIELD,
  getConfig: defaultGetConfig,
  missingRouteVariables,
} = require("./config");
const { OuvidoriaError, errorBody } = require("./errors");
const { validateFile, allowedExtensions } = require("./fileValidator");
const { validateFields } = require("./submission");
const formToken = require("./formToken");
const { createStorage } = require("./s3Storage");

/**
 * Lógica das ações `sendOuvidoria` e `ouvidoriaConfig` do controller
 * `contact-channel`. Recebe as dependências por injeção para ser testável
 * sem subir o Strapi.
 */

function createHandlers({
  getConfig = defaultGetConfig,
  findChannel,
  queue,
  queueName,
  storageFactory = createStorage,
  fsp = fs.promises,
  now = () => Date.now(),
  log = console,
}) {
  // A configuração vem de variáveis de ambiente e não muda com o processo no ar.
  let storage = null;
  const getStorage = (config) => {
    if (!storage) storage = storageFactory(config);
    return storage;
  };

  function respond(ctx, status, body) {
    ctx.status = status;
    ctx.body = body;
  }

  function fail(ctx, error) {
    respond(ctx, error.status, errorBody(error.status, error.code, error.message, error.details));
  }

  async function resolveChannel(id) {
    const channel = await findChannel(id);
    if (!channel) throw new OuvidoriaError(404, "CHANNEL_NOT_FOUND", "Canal não encontrado");
    if (channel.flow !== FLOW) {
      throw new OuvidoriaError(400, "CHANNEL_NOT_OUVIDORIA", "Canal não é a Ouvidoria");
    }
    return channel;
  }

  function assertReady(config) {
    if (!config.enabled) throw new OuvidoriaError(404, "OUVIDORIA_DISABLED", "Not Found");
    if (missingRouteVariables(config).length > 0) {
      throw new OuvidoriaError(503, "OUVIDORIA_MISCONFIGURED", "Service unavailable");
    }
  }

  /** GET /contact-channels/:id/ouvidoria/config */
  async function ouvidoriaConfig(ctx) {
    try {
      const config = getConfig();
      assertReady(config);
      await resolveChannel(ctx.params.id);

      ctx.set("Cache-Control", "no-store");
      respond(ctx, 200, {
        token: formToken.issue(config.formToken.secret, now()),
        maxFileBytes: config.maxFileBytes,
        allowedExtensions: allowedExtensions(),
        allowAnonymous: config.allowAnonymous,
        minAgeSeconds: config.formToken.minAgeSeconds,
      });
    } catch (error) {
      if (error instanceof OuvidoriaError) return fail(ctx, error);
      log.error("[OUVIDORIA] erro em ouvidoriaConfig:", error.message);
      respond(ctx, 500, errorBody(500, "INTERNAL_ERROR", "Erro interno"));
    }
  }

  // Campos e arquivos lidos pelo guard (ver guard.js e multipart.js).
  function submittedForm(ctx) {
    const form = (ctx.state && ctx.state.ouvidoriaForm) || {};
    return { fields: form.fields || {}, files: form.files || {} };
  }

  function uploadedFiles(ctx) {
    const files = submittedForm(ctx).files;
    const list = [];
    Object.keys(files).forEach((key) => {
      [].concat(files[key]).forEach((file) => file && list.push({ key, file }));
    });
    return list;
  }

  async function removeQuietly(filePath) {
    if (!filePath) return;
    try {
      await fsp.unlink(filePath);
    } catch (error) {
      if (error.code !== "ENOENT") {
        log.warn(`[OUVIDORIA] não foi possível apagar arquivo temporário: ${error.code}`);
      }
    }
  }

  /** POST /contact-channels/:id/sendOuvidoria */
  async function sendOuvidoria(ctx) {
    const received = uploadedFiles(ctx);

    try {
      const config = getConfig();
      assertReady(config);

      const channel = await resolveChannel(ctx.params.id);
      const body = submittedForm(ctx).fields;

      // Honeypot: bot preencheu o campo oculto. Resposta igual à de sucesso.
      if (String(body[HONEYPOT_FIELD] || "").trim() !== "") {
        log.warn("[OUVIDORIA] honeypot acionado, envio descartado");
        return respond(ctx, 202, { message: "accepted" });
      }

      const fields = validateFields(body, config);
      if (!fields.ok) {
        throw new OuvidoriaError(400, "VALIDATION_ERROR", "Campos inválidos", { fields: fields.errors });
      }

      // Com a identificação opcional, o envio ainda precisa ter conteúdo: o relato ou uma prova.
      if (received.length === 0 && fields.values.message === "") {
        throw new OuvidoriaError(400, "EMPTY_SUBMISSION", "Informe o relato ou anexe um arquivo");
      }

      if (received.length > 1) {
        throw new OuvidoriaError(400, "TOO_MANY_FILES", "Envie no máximo um arquivo");
      }
      if (received.length === 1 && received[0].key !== FILE_FIELD) {
        throw new OuvidoriaError(400, "FILE_INVALID", "Campo de arquivo inválido");
      }

      let fileData = null;
      if (received.length === 1) {
        const upload = received[0].file;
        const info = await validateFile(upload, config);

        // O arquivo só chega ao bucket depois de validado. O temporário do parser
        // é apagado no `finally`, haja sucesso ou erro.
        const files = getStorage(config);
        const key = files.newKey(info.ext);
        try {
          await files.upload({
            filePath: upload.path,
            key,
            size: info.size,
            mime: info.mime,
            originalName: info.safeName,
          });
        } catch (error) {
          log.error(`[OUVIDORIA] falha ao enviar o anexo ao S3: ${error.code || error.message}`);
          throw new OuvidoriaError(503, "STORAGE_UNAVAILABLE", "Não foi possível receber o arquivo agora");
        }
        fileData = { key, originalName: info.safeName, size: info.size, ext: info.ext };
      }

      const submissionId = crypto.randomBytes(12).toString("hex");
      const data = {
        submissionId,
        receivedAt: new Date(now()).toISOString(),
        channel: channel.name,
        serviceCode: channel.service_code,
        fields: fields.values,
        file: fileData,
        state: {},
      };

      try {
        await queue.add(queueName, data, {
          jobId: submissionId,
          attempts: config.job.attempts,
          backoff: { type: "exponential", delay: config.job.backoffMs },
          timeout: config.job.timeoutMs,
          removeOnComplete: true,
          // Falha definitiva fica na fila para recuperação manual (o anexo segue no bucket).
          removeOnFail: false,
        });
      } catch (error) {
        log.error(`[OUVIDORIA] falha ao enfileirar ${submissionId}: ${error.message}`);
        if (fileData) {
          // O usuário vai reenviar; o objeto já gravado não pode ficar órfão no bucket.
          await getStorage(config).remove(fileData.key).catch((removeError) => {
            log.error(`[OUVIDORIA] objeto órfão ${fileData.key} não removido: ${removeError.code || removeError.message}`);
          });
        }
        throw new OuvidoriaError(503, "QUEUE_UNAVAILABLE", "Não foi possível registrar o envio agora");
      }

      log.log(`[OUVIDORIA] envio ${submissionId} enfileirado (arquivo: ${fileData ? "sim" : "não"})`);
      return respond(ctx, 202, { message: "accepted" });
    } catch (error) {
      if (error instanceof OuvidoriaError) return fail(ctx, error);
      log.error("[OUVIDORIA] erro em sendOuvidoria:", error.message);
      return respond(ctx, 500, errorBody(500, "INTERNAL_ERROR", "Erro interno"));
    } finally {
      // Temporários do parser são sempre descartados.
      await Promise.all(received.map(({ file }) => removeQuietly(file.path)));
    }
  }

  return { ouvidoriaConfig, sendOuvidoria };
}

module.exports = { createHandlers };
