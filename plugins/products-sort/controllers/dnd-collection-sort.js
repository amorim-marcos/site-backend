"use strict";

module.exports = {
  getProducts: async () => {
    return await strapi.services.products.find({
      _sort: "scale:ASC",
    });
  },
  sortProducts: async (ctx) => {
    const { sortedProducts } = ctx.request.body;

    Promise.all(
      sortedProducts.map(async (data) => {
        return strapi.query("products").update(
          { id: data.id, avoidHook: true },
          { scale: data.scale }
        );
      })
    );

    ctx.send({ message: "ok" });
  },
};
