"use strict";

const fs = require("fs");
const path = require("path");

/**
 * Diretório temporário do multipart da Ouvidoria.
 *
 * O parser do Strapi grava o arquivo aqui; o handler o valida, envia ao S3 e o
 * apaga na própria request. Nada aqui é lido por outro processo, então qualquer
 * arquivo parado há mais que `maxAgeMs` é sobra de uma request que morreu
 * (reinício, falta de memória) e pode ser apagado com segurança. Uploads lentos
 * não são afetados: a data de modificação renova a cada trecho recebido.
 */

/**
 * Cria o diretório (modo 0700, só o dono) e confirma que é gravável. Síncrono
 * porque roda ao montar a configuração do parser, antes do primeiro upload.
 *
 * @returns {{ok: boolean, error?: string}}
 */
function ensureTempDir(dir, fsImpl = fs) {
  try {
    fsImpl.mkdirSync(dir, { recursive: true, mode: 0o700 });
    // `mkdir` não altera o modo de um diretório que já existia.
    fsImpl.chmodSync(dir, 0o700);
    fsImpl.accessSync(dir, fs.constants.W_OK);
    return { ok: true };
  } catch (error) {
    return { ok: false, error: error.code || error.message };
  }
}

/**
 * Apaga arquivos do diretório mais antigos que `maxAgeMs`.
 *
 * @returns {Promise<number>} quantidade de arquivos removidos
 */
async function sweepTempDir({ dir, maxAgeMs, now = Date.now(), fsp = fs.promises, log = console }) {
  if (!dir) return 0;

  let entries;
  try {
    entries = await fsp.readdir(dir, { withFileTypes: true });
  } catch (error) {
    if (error.code === "ENOENT") return 0;
    throw error;
  }

  const limit = now - maxAgeMs;
  let removed = 0;

  for (const entry of entries) {
    if (!entry.isFile()) continue;
    const filePath = path.join(dir, entry.name);
    try {
      const { mtimeMs } = await fsp.stat(filePath);
      if (mtimeMs < limit) {
        await fsp.unlink(filePath);
        removed += 1;
      }
    } catch (error) {
      if (error.code !== "ENOENT") {
        log.warn(`[OUVIDORIA] limpeza do temporário: não foi possível processar um arquivo (${error.code})`);
      }
    }
  }

  if (removed > 0) log.warn(`[OUVIDORIA] limpeza do temporário removeu ${removed} arquivo(s) órfão(s)`);
  return removed;
}

module.exports = { ensureTempDir, sweepTempDir };
