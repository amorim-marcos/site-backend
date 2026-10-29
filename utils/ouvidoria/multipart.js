"use strict";

const fs = require("fs");
const formidable = require("formidable");
const { OuvidoriaError } = require("./errors");

/**
 * Leitura do multipart da Ouvidoria, só para esta rota.
 *
 * O parser global do Strapi (koa-body) grava no diretório temporário do sistema,
 * vale para todas as rotas e não tem como ser configurado por rota. Aqui o guard
 * lê o corpo antes dele, gravando num diretório dedicado e restrito, com limites
 * próprios, sem afetar nenhum outro upload do site (biblioteca de mídia do admin,
 * por exemplo).
 */

// Campos de texto: 7 do formulário, honeypot e folga. A mensagem tem até 4000 caracteres.
const MAX_FIELDS = 30;
const MAX_FIELDS_BYTES = 256 * 1024;

function removeQuietly(filePath) {
  fs.unlink(filePath, () => {});
}

/**
 * O formidable 1.x pode dar a leitura por concluída mesmo quando a gravação falhou
 * (corpo pequeno que termina antes do erro de escrita chegar). Confirma em disco que
 * cada arquivo existe e tem o tamanho recebido.
 */
function assertWritten(files) {
  Object.keys(files).forEach((key) => {
    [].concat(files[key]).forEach((file) => {
      const { size } = fs.statSync(file.path); // ENOENT se nunca foi criado
      if (size !== file.size) {
        throw Object.assign(new Error("arquivo gravado incompleto"), { code: "ENOSPC" });
      }
    });
  });
}

function mapError(error) {
  const message = String((error && error.message) || "");
  if (message.includes("maxFileSize exceeded") || message.includes("maxFieldsSize exceeded") || message.includes("maxFields exceeded")) {
    return new OuvidoriaError(413, "BODY_TOO_LARGE", "Corpo da requisição acima do limite");
  }
  // Disco temporário indisponível (diretório removido, sem permissão, disco cheio).
  if (error && ["ENOENT", "EACCES", "ENOSPC", "EROFS"].includes(error.code)) {
    return new OuvidoriaError(503, "STORAGE_UNAVAILABLE", "Não foi possível receber o arquivo agora");
  }
  return new OuvidoriaError(400, "MALFORMED_MULTIPART", "Corpo multipart inválido");
}

/**
 * @param {import("http").IncomingMessage} req
 * @param {{uploadDir: string, maxBodyBytes: number}} options
 * @returns {Promise<{fields: object, files: object}>} `files` no formato do formidable 1.x
 *   (`{path, name, size, type}`); arquivos repetidos no mesmo campo viram array.
 *   Em erro, todo arquivo já gravado é apagado.
 */
function parseMultipart(req, { uploadDir, maxBodyBytes }) {
  return new Promise((resolve, reject) => {
    // O formidable 1.x também lê JSON e urlencoded; aqui só multipart.
    if (!/^multipart\/form-data/i.test(String((req.headers && req.headers["content-type"]) || ""))) {
      return reject(new OuvidoriaError(400, "MALFORMED_MULTIPART", "Corpo multipart inválido"));
    }

    const form = new formidable.IncomingForm();
    form.uploadDir = uploadDir;
    form.keepExtensions = false;
    form.multiples = true;
    // O limite do arquivo é conferido de novo, em disco, pelo validador; este é só o teto do corpo.
    form.maxFileSize = maxBodyBytes;
    form.maxFields = MAX_FIELDS;
    form.maxFieldsSize = MAX_FIELDS_BYTES;

    const written = [];
    form.on("fileBegin", (name, file) => {
      written.push(file.path);
      // O formidable 1.x não escuta erro do stream de escrita. Sem listener, disco cheio ou
      // diretório removido viram exceção não capturada e derrubam o processo do site.
      // O stream é criado logo depois deste evento; `_error` é a via que o próprio
      // formidable usa para abortar e apagar os arquivos parciais.
      process.nextTick(() => {
        if (file._writeStream) file._writeStream.on("error", (error) => form._error(error));
      });
    });

    form.parse(req, (error, fields, files) => {
      if (!error && Object.keys(fields).length > MAX_FIELDS) {
        // O formidable só aplica `maxFields` ao urlencoded; o tamanho total dos campos já é limitado.
        error = new Error("maxFields exceeded");
      }
      if (!error) {
        try {
          assertWritten(files);
        } catch (writeError) {
          error = writeError;
        }
      }
      if (error) {
        written.forEach(removeQuietly);
        return reject(mapError(error));
      }
      return resolve({ fields, files });
    });
  });
}

module.exports = { parseMultipart };
