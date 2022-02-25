'use strict';

/**
 * Read the documentation (https://strapi.io/documentation/developer-docs/latest/development/backend-customization.html#core-services)
 * to customize this service
 */

module.exports = {
    countHighliteds: () => {
        return strapi.query('posts').count({ is_highlighted: true })
    },
    getHighlighted: () => {
        return strapi.query('posts').find({ is_highlighted: true})
    }
};
