'use strict';

/**
 * Read the documentation (https://strapi.io/documentation/developer-docs/latest/development/backend-customization.html#lifecycle-hooks)
 * to customize this model
 */

module.exports = {
    lifecycles: {
        async beforeCreate(data) {
            const totalWithSameTitle = await strapi.services.ambients.countWithSameTitle(data.title)
            data.url_code = await strapi.services.ambients.generateSlug(data.title,totalWithSameTitle + 1)
        },
        async beforeUpdate(params, data) {
            const totalWithSameTitle = await strapi.services.ambients.countWithSameTitle(data.title)
            data.url_code = await strapi.services.ambients.generateSlug(data.title,totalWithSameTitle + 1)
        },
    }
};
