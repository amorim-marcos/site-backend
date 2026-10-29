"use strict";

const ACTIONS = ["sendouvidoria", "ouvidoriaconfig"];
const CONTROLLER = "contact-channel";

/**
 * Garante que as rotas da Ouvidoria estejam liberadas para o papel Public.
 * Idempotente: só altera o que está desligado ou ausente, e não faz nada com a
 * funcionalidade desligada. Independe de o Strapi já ter criado as linhas de
 * permissão: se não existirem, são criadas.
 *
 * @param {{strapi: object, config: {enabled: boolean}, log?: object}} deps
 * @returns {Promise<{changed: number}>}
 */
async function ensurePublicPermissions({ strapi, config, log = console }) {
  if (!config.enabled) return { changed: 0 };

  const query = (name) => strapi.query(name, "users-permissions");

  const role = await query("role").findOne({ type: "public" });
  if (!role) {
    log.warn("[OUVIDORIA] papel Public não encontrado; permissões não ajustadas");
    return { changed: 0 };
  }

  let changed = 0;
  for (const action of ACTIONS) {
    const where = { controller: CONTROLLER, action, role: role.id };
    const found = await query("permission").findOne(where);

    if (!found) {
      await query("permission").create({ ...where, type: "application", policy: "", enabled: true });
      changed += 1;
    } else if (!found.enabled) {
      await query("permission").update({ id: found.id }, { enabled: true });
      changed += 1;
    }
  }

  if (changed > 0) log.info(`[OUVIDORIA] ${changed} permissão(ões) pública(s) habilitada(s)`);
  return { changed };
}

module.exports = { ensurePublicPermissions, ACTIONS };
