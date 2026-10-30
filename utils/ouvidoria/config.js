"use strict";

/**
 * Configuração do fluxo da Ouvidoria.
 *
 * Tudo que muda por ambiente vem de variáveis de ambiente. Os valores abaixo
 * são constantes de contrato (nome do flow, atributos da entidade, etc.).
 */

const FLOW = "ouvidoria";
const MB = 1024 * 1024;

// Atributos da entidade do SE, assumidos iguais aos do `pfaleconosco`.
const ENTITY_ATTRIBUTES = {
  name: "solnome",
  email: "solemail",
  message: "solmensagem",
  phone: "solfone",
  state: "soluf",
  company: "solempresa",
  city: "solcidade",
  // URL do anexo no download seguro (campo criado pela TI Berneck; 255 caracteres).
  attachment: "anexo1",
};

const FILE_FIELD = "file";
const HONEYPOT_FIELD = "website";
const TOKEN_HEADER = "x-ouvidoria-token";

function toBool(value, fallback) {
  if (value === undefined || value === null || value === "") return fallback;
  return ["1", "true", "yes", "on"].includes(String(value).toLowerCase());
}

function toInt(value, fallback) {
  const parsed = parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function getConfig(env = process.env) {
  const maxFileMb = toInt(env.OUVIDORIA_MAX_FILE_MB, 50);

  return {
    enabled: toBool(env.OUVIDORIA_ENABLED, false),
    // Nome do canal que usa o fluxo da Ouvidoria (as traduções são achadas pelas localizações).
    channelName: env.OUVIDORIA_CHANNEL_NAME || "Ouvidoria",
    // Identificação opcional (denúncia anônima). `false` volta a exigir os campos.
    allowAnonymous: toBool(env.OUVIDORIA_ALLOW_ANONYMOUS, true),

    maxFileBytes: maxFileMb * MB,
    // Folga para os campos de texto do multipart.
    maxBodyBytes: maxFileMb * MB + 1 * MB,

    // Temporário do multipart: disco local, nunca o EFS.
    // O arquivo só vive durante a request; sobras de processo morto são varridas.
    temp: {
      dir: env.OUVIDORIA_TEMP_DIR || "",
      maxAgeMs: toInt(env.OUVIDORIA_TEMP_MAX_AGE_MIN, 60) * 60 * 1000,
      sweepIntervalMs: toInt(env.OUVIDORIA_TEMP_SWEEP_MIN, 15) * 60 * 1000,
      maxConcurrentUploads: toInt(env.OUVIDORIA_MAX_CONCURRENT_UPLOADS, 3),
    },

    // Bucket dos anexos. Sem chaves explícitas o SDK usa a cadeia padrão (role da instância).
    s3: {
      bucket: env.OUVIDORIA_S3_BUCKET || "",
      region: env.OUVIDORIA_S3_REGION || "",
      accessKeyId: env.OUVIDORIA_S3_ACCESS_KEY_ID || "",
      secretAccessKey: env.OUVIDORIA_S3_SECRET_ACCESS_KEY || "",
      prefix: env.OUVIDORIA_S3_PREFIX || "",
      // Só para testes locais (ex.: emulador de S3).
      endpoint: env.OUVIDORIA_S3_ENDPOINT || "",
    },

    // Endereço do download seguro; a URL entregue ao SE é `<baseUrl>/<chave do objeto>`.
    attachment: {
      baseUrl: (env.OUVIDORIA_ATTACHMENT_BASE_URL || "").replace(/\/+$/, ""),
    },

    // Espera da varredura do GuardDuty antes de entregar o link ao SE.
    scan: {
      wait: toBool(env.OUVIDORIA_WAIT_SCAN, true),
      timeoutMs: toInt(env.OUVIDORIA_SCAN_TIMEOUT_MIN, 10) * 60 * 1000,
      pollIntervalMs: toInt(env.OUVIDORIA_SCAN_POLL_SECONDS, 10) * 1000,
    },

    rate: {
      ipMax: toInt(env.OUVIDORIA_RATE_IP_MAX, 3),
      ipWindowMs: toInt(env.OUVIDORIA_RATE_IP_WINDOW_MIN, 10) * 60 * 1000,
      globalMaxPerHour: toInt(env.OUVIDORIA_RATE_GLOBAL_MAX_HOUR, 10),
    },

    formToken: {
      secret: env.OUVIDORIA_FORM_TOKEN_SECRET || "",
      minAgeSeconds: toInt(env.OUVIDORIA_FORM_MIN_SECONDS, 3),
      maxAgeMs: toInt(env.OUVIDORIA_FORM_MAX_AGE_MIN, 60) * 60 * 1000,
    },

    job: {
      attempts: toInt(env.OUVIDORIA_JOB_ATTEMPTS, 8),
      backoffMs: toInt(env.OUVIDORIA_JOB_BACKOFF_SECONDS, 30) * 1000,
      // Cobre a espera da varredura (até scan.timeoutMs) e as chamadas ao SE.
      timeoutMs: toInt(env.OUVIDORIA_JOB_TIMEOUT_MIN, 20) * 60 * 1000,
      concurrency: toInt(env.OUVIDORIA_CONCURRENCY, 2),
    },

    se: {
      wsdlUrl: env.SE_WSDL_URL || "",
      wsdlLocation: env.SE_WSDL_LOCATION || "",
      // Token próprio da Ouvidoria; sem ele usa o do Fale Conosco.
      authToken: env.SE_OUVIDORIA_AUTH_TOKEN || env.SE_AUTH_TOKEN || "",
      processId: env.SE_OUVIDORIA_PROCESS_ID || "",
      userId: env.SE_OUVIDORIA_USER_ID || "",
      entityId: env.SE_OUVIDORIA_ENTITY_ID || "",
      activityId: env.SE_OUVIDORIA_ACTIVITY_ID || "",
      actionSequence: env.SE_OUVIDORIA_ACTION_SEQUENCE || "1",
      // Opcional: atributo da entidade que recebe a situação do anexo (ex.: retido
      // pela segurança). Sem ele, a situação só vai para o log.
      attachmentNoteAttribute: env.SE_OUVIDORIA_ATTACHMENT_NOTE_ATTRIBUTE || "",
    },
  };
}

/** Variáveis obrigatórias para a rota aceitar envios. */
function missingRouteVariables(config) {
  const missing = [];
  if (!config.temp.dir) missing.push("OUVIDORIA_TEMP_DIR");
  if (!config.s3.bucket) missing.push("OUVIDORIA_S3_BUCKET");
  if (!config.s3.region) missing.push("OUVIDORIA_S3_REGION");
  if (!config.attachment.baseUrl) missing.push("OUVIDORIA_ATTACHMENT_BASE_URL");
  if (!config.formToken.secret) missing.push("OUVIDORIA_FORM_TOKEN_SECRET");
  return missing;
}

/** Variáveis obrigatórias para o job falar com o SE. */
function missingSeVariables(config) {
  const required = {
    SE_WSDL_URL: config.se.wsdlUrl,
    SE_OUVIDORIA_AUTH_TOKEN: config.se.authToken,
    SE_OUVIDORIA_PROCESS_ID: config.se.processId,
    SE_OUVIDORIA_USER_ID: config.se.userId,
    SE_OUVIDORIA_ENTITY_ID: config.se.entityId,
    SE_OUVIDORIA_ACTIVITY_ID: config.se.activityId,
  };
  return Object.keys(required).filter((key) => !required[key]);
}

module.exports = {
  FLOW,
  MB,
  ENTITY_ATTRIBUTES,
  FILE_FIELD,
  HONEYPOT_FIELD,
  TOKEN_HEADER,
  getConfig,
  missingRouteVariables,
  missingSeVariables,
};
