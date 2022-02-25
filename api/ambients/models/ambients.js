'use strict';

/**
 * Read the documentation (https://strapi.io/documentation/developer-docs/latest/development/backend-customization.html#lifecycle-hooks)
 * to customize this model
 */

module.exports = {
    lifecycles: {
        async beforeCreate(data) {
            data.url_code = data.place.normalize("NFD").replace(/[^\w ]/g, "").split(' ').join('-').toLowerCase()
        },
    }
};
