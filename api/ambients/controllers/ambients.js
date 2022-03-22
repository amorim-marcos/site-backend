"use strict";
const { sanitizeEntity } = require("strapi-utils");

/**
 * Read the documentation (https://strapi.io/documentation/developer-docs/latest/development/backend-customization.html#core-controllers)
 * to customize this controller
 */

module.exports = {
  findOne: async (ctx) => {
    const { id } = ctx.params;

    let ambient = await strapi.services.ambients.findOne({ id });

    ambient = sanitizeEntity(ambient, { model: strapi.models.ambients });

    ambient.products = ambient.products.map(async (data) => ({
      ...data,
      product_texture: sanitizeEntity(
        await strapi.query("products-textures").findOne({
          id: data.product_texture,
        }),
        { model: strapi.models["products-textures"] }
      ),
    }));

    ambient.products = await Promise.all(ambient.products);

    return ambient;
  },
};
