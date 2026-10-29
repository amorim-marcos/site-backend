"use strict";

const crypto = require("crypto");
const fs = require("fs");

/**
 * Armazenamento dos anexos da Ouvidoria no S3.
 *
 * - O upload acontece dentro da request, a partir do temporário já validado.
 * - O bucket é privado. O download é do lado da TI Berneck (Cognito + MFA); aqui
 *   só se grava o objeto e se lê a tag que o GuardDuty Malware Protection aplica.
 * - SDK v2: o v3 atual exige Node >= 20 nas dependências e o projeto roda em Node 14.
 */

const SCAN_TAG = "GuardDutyMalwareScanStatus";

// Resultados da varredura que liberam o arquivo; os demais o mantêm em quarentena.
const SCAN_CLEAN = "NO_THREATS_FOUND";

const UPLOAD_ATTEMPTS = 2;

function createS3Client(s3) {
  // Carregado só aqui: testes e rotas sem arquivo não pagam o custo do require.
  const S3 = require("aws-sdk/clients/s3");

  const options = {
    region: s3.region,
    signatureVersion: "v4",
    // Um stream já consumido não pode ser reenviado pelo SDK; as tentativas são nossas.
    maxRetries: 0,
    httpOptions: { connectTimeout: 5000, timeout: 120000 },
  };
  if (s3.accessKeyId && s3.secretAccessKey) {
    options.accessKeyId = s3.accessKeyId;
    options.secretAccessKey = s3.secretAccessKey;
  }
  if (s3.endpoint) {
    options.endpoint = s3.endpoint;
    options.s3ForcePathStyle = true;
  }
  return new S3(options);
}

function normalizePrefix(prefix) {
  const trimmed = String(prefix || "").replace(/^\/+/, "");
  if (trimmed === "") return "";
  return trimmed.endsWith("/") ? trimmed : `${trimmed}/`;
}

/**
 * @param {{s3: object, attachment: {baseUrl: string}}} config
 * @param {{client?: object}} [deps] cliente com `putObject`/`getObjectTagging`/`deleteObject` (`.promise()`), para testes
 */
function createStorage(config, { client, fsImpl = fs } = {}) {
  const { s3, attachment } = config;
  const s3Client = client || createS3Client(s3);
  const prefix = normalizePrefix(s3.prefix);

  /** Nome único e não adivinhável: o nome enviado pelo usuário nunca vira chave. */
  function newKey(ext) {
    return `${prefix}${crypto.randomBytes(16).toString("hex")}.${ext}`;
  }

  /** URL do download seguro entregue ao SE: `<baseUrl>/<chave>`. */
  function urlFor(key) {
    return `${attachment.baseUrl}/${key.split("/").map(encodeURIComponent).join("/")}`;
  }

  async function upload({ filePath, key, size, mime, originalName }) {
    let lastError;
    for (let attempt = 1; attempt <= UPLOAD_ATTEMPTS; attempt += 1) {
      const body = fsImpl.createReadStream(filePath);
      try {
        await s3Client
          .putObject({
            Bucket: s3.bucket,
            Key: key,
            Body: body,
            ContentLength: size,
            ContentType: mime,
            // Cabeçalhos de metadado precisam ser ASCII.
            Metadata: { "original-name": encodeURIComponent(originalName || "") },
          })
          .promise();
        return;
      } catch (error) {
        lastError = error;
      } finally {
        body.destroy();
      }
    }
    throw lastError;
  }

  /**
   * @returns {Promise<string|null>} valor da tag de varredura, ou null se o
   *   GuardDuty ainda não a aplicou.
   */
  async function scanStatus(key) {
    const { TagSet } = await s3Client.getObjectTagging({ Bucket: s3.bucket, Key: key }).promise();
    const tag = (TagSet || []).find((item) => item.Key === SCAN_TAG);
    return tag ? tag.Value : null;
  }

  async function remove(key) {
    await s3Client.deleteObject({ Bucket: s3.bucket, Key: key }).promise();
  }

  return { newKey, urlFor, upload, scanStatus, remove };
}

module.exports = { createStorage, SCAN_TAG, SCAN_CLEAN };
