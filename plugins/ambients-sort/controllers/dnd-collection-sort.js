"use strict";

module.exports = {
  getUrl: async () => {
    const url = await strapi.config.get(
      "server.url",
      "defaultValueIfUndefined"
    );

    return { url };
  },
  getAmbients: async () => {
    return await strapi.services.ambients.find({
      _sort: "custom_order:ASC",
    });
  },
  sortAmbients: async (ctx) => {
    const { sortedAmbients } = ctx.request.body;

    Promise.all(
      sortedAmbients.map(async (data) => {
        return strapi
          .query("ambients")
          .update(
            { id: data.id, avoidHook: true },
            { custom_order: data.custom_order }
          );
      })
    );

    ctx.send({ message: "ok" });
  },
};
