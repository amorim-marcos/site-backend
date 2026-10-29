"use strict";

const { createGuard } = require("../../utils/ouvidoria/guard");
const { getConfig } = require("../../utils/ouvidoria/config");
const { ensureTempDir } = require("../../utils/ouvidoria/tempDir");

/**
 * Registra o guard da Ouvidoria. Carregado em `load.before` (config/middleware.js)
 * para rodar antes do parser multipart do Strapi.
 */
module.exports = () => {
  return {
    initialize() {
      // Falha de permissão no diretório temporário aparece na subida, não no primeiro envio.
      const { enabled, temp } = getConfig();
      if (enabled && temp.dir) {
        const result = ensureTempDir(temp.dir);
        if (!result.ok) {
          strapi.log.error(`[OUVIDORIA] diretório temporário inválido (${temp.dir}): ${result.error}. Os envios vão falhar.`);
        }
      }

      strapi.app.use(createGuard());
    },
  };
};
