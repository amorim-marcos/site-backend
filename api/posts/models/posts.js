'use strict';

/**
 * Read the documentation (https://strapi.io/documentation/developer-docs/latest/development/backend-customization.html#lifecycle-hooks)
 * to customize this model
 */

module.exports = {
    lifecycles: {
        beforeCreate(data) {
            data.url_code = data.title.normalize("NFD").replace(/[^\w ]/g, "").split(' ').join('-').toLowerCase()
        },
    }
};
