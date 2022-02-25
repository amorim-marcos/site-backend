'use strict';
const { sanitizeEntity } = require('strapi-utils');

/**
 * Read the documentation (https://strapi.io/documentation/developer-docs/latest/development/backend-customization.html#core-controllers)
 * to customize this controller
 */

module.exports = {
    findOne: async ctx => {
        // const id = ctx.params.id;
        const { url_code } = ctx.params;

        const entity = await strapi.services.products.findOne({ url_code: url_code });

        return sanitizeEntity(entity, { model: strapi.models.products });
    },
};
