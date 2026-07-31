"use strict";

// Must match plugin_i18n_default_locale in migrations/configs/core_store.json
// and MASTER_LOCALE in api/products/models/products.js. This screen only
// ever shows/writes the master locale (pt-BR) — one card per product,
// instead of every locale's row mixed together. Other locales inherit
// `scale` automatically via the afterUpdate cascade in the products model.
const MASTER_LOCALE = "pt-BR";

module.exports = {
  getUrl: async () => {
    const url = await strapi.config.get(
      "server.url",
      "defaultValueIfUndefined"
    );

    return { url };
  },
  getProducts: async () => {
    return await strapi.services.products.find({
      _sort: "scale:ASC",
      locale: MASTER_LOCALE,
    });
  },
  sortProducts: async (ctx) => {
    const { sortedProducts } = ctx.request.body;

    Promise.all(
      sortedProducts.map(async (data) => {
        return strapi
          .query("products")
          .update({ id: data.id, avoidHook: true }, { scale: data.scale });
      })
    );

    ctx.send({ message: "ok" });
  },
};
