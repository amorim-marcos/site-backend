'use strict';

/**
 * Read the documentation (https://strapi.io/documentation/developer-docs/latest/development/backend-customization.html#lifecycle-hooks)
 * to customize this model
 */

module.exports = {
    lifecycles: {
        async afterCreate(result, data) {
           const url_code = await strapi.services.ambients.generateSlug(data.title,result.id)
           await strapi.query('ambients').update({ id: result.id }, { url_code: url_code})
        }
    }
};
