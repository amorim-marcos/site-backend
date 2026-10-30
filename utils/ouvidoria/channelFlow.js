"use strict";

const FLOW_OUVIDORIA = "ouvidoria";
const FLOW_DEFAULT = "default";

const normalize = (value) => String(value || "").trim().toLowerCase();

/**
 * Mantém o `flow` do canal da Ouvidoria de acordo com a funcionalidade.
 *
 * - Ligada: o canal com o nome configurado, e as traduções dele, passam a usar o
 *   fluxo `ouvidoria` (formulário novo).
 * - Desligada: qualquer canal em `ouvidoria` volta ao fluxo padrão. Assim, desligar
 *   a flag é o rollback: o formulário antigo volta junto com a rota fechada.
 *
 * Idempotente: só altera o que está diferente do esperado.
 *
 * @param {{strapi: object, config: {enabled: boolean, channelName: string}, log?: object}} deps
 * @returns {Promise<{changed: number}>}
 */
async function syncChannelFlow({ strapi, config, log = console }) {
  const query = strapi.query("contact-channel");
  const channels = await query.find({ _limit: -1 }, ["localizations"]);

  let targets;
  let flow;
  if (config.enabled) {
    flow = FLOW_OUVIDORIA;
    const ids = new Set();
    channels
      .filter((channel) => normalize(channel.name) === normalize(config.channelName))
      .forEach((channel) => {
        ids.add(channel.id);
        (channel.localizations || []).forEach((localization) => ids.add(localization.id));
      });
    targets = channels.filter((channel) => ids.has(channel.id) && channel.flow !== FLOW_OUVIDORIA);
    if (ids.size === 0) {
      log.warn(`[OUVIDORIA] nenhum canal chamado "${config.channelName}" para usar o fluxo novo`);
    }
  } else {
    flow = FLOW_DEFAULT;
    targets = channels.filter((channel) => channel.flow === FLOW_OUVIDORIA);
  }

  for (const channel of targets) {
    await query.update({ id: channel.id }, { flow });
  }

  if (targets.length > 0) {
    log.info(`[OUVIDORIA] ${targets.length} canal(is) com fluxo "${flow}"`);
  }
  return { changed: targets.length };
}

module.exports = { syncChannelFlow, FLOW_OUVIDORIA, FLOW_DEFAULT };
