"use strict";

/**
 * Read the documentation (https://strapi.io/documentation/developer-docs/latest/development/backend-customization.html#lifecycle-hooks)
 * to customize this model
 */

module.exports = {
  lifecycles: {
    async beforeCreate(data) {
      if (!data.products || data.products.length == 0) {
        throw strapi.errors.badRequest(
          `É necessário escolher pelo menos um BP associado ao ambiente.`
        );
      }
    },
    async beforeUpdate(params, data) {
      if (
        !params.avoidHook &&
        data.title &&
        (!data.products || data.products.length == 0)
      ) {
        throw strapi.errors.badRequest(
          `É necessário escolher pelo menos um BP associado ao ambiente.`
        );
      }

      if (params.avoidHook) delete params.avoidHook;
    },
    async afterUpdate(result, data) {
      const currentUrlCode = result.url_code;
      const newUrlCode = await strapi.services.ambients.generateSlug(
        data?.title ?? result?.title,
        result.id
      );

      if (currentUrlCode !== newUrlCode) {
        await strapi
          .query("ambients")
          .update({ id: result.id, avoidHook: true }, { url_code: newUrlCode });
      }
    },
    async afterCreate(result, data) {
      const url_code = await strapi.services.ambients.generateSlug(
        data?.title ?? result?.title,
        result.id
      );
      await strapi
        .query("ambients")
        .update({ id: result.id, avoidHook: true }, { url_code: url_code });
    },
  },
};
