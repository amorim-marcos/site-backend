'use strict';

const { applyTrustedProxyHops } = require('../../utils/trusted-proxy');
const { getConfig: getOuvidoriaConfig } = require('../../utils/ouvidoria/config');
const { ensurePublicPermissions } = require('../../utils/ouvidoria/permissions');

/**
 * An asynchronous bootstrap function that runs before
 * your application gets started.
 *
 * This gives you an opportunity to set up your data model,
 * run jobs, or perform some special logic.
 *
 * See more details here: https://strapi.io/documentation/developer-docs/latest/setup-deployment-guides/configurations.html#bootstrap
 */

module.exports = async () => {
  // IP real atrás de proxy (PROXY_ENABLED + PROXY_TRUSTED_HOPS). Ver utils/trusted-proxy.js.
  const hops = applyTrustedProxyHops(strapi.app);
  if (hops > 0) {
    strapi.log.info(`Proxy confiável ligado: usando os últimos ${hops} IP(s) do X-Forwarded-For`);
  } else if (getOuvidoriaConfig().enabled) {
    strapi.log.warn('Ouvidoria ativa com PROXY_ENABLED desligado: o rate limit verá o IP do proxy, não o do cliente');
  }

  try {
    await ensurePublicPermissions({ strapi, config: getOuvidoriaConfig(), log: strapi.log });
  } catch (error) {
    strapi.log.error(`[OUVIDORIA] falha ao garantir as permissões públicas: ${error.message}`);
  }
};
