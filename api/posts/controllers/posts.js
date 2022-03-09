'use strict';

/**
 * Read the documentation (https://strapi.io/documentation/developer-docs/latest/development/backend-customization.html#core-controllers)
 * to customize this controller
 */

const { sanitizeEntity } = require('strapi-utils');


module.exports = {
    findOne: async ctx => {
        // const id = ctx.params.id;
        const { url_code } = ctx.params;

        const entity = await strapi.services.posts.findOne({ url_code: url_code });

        return sanitizeEntity(entity, { model: strapi.models.posts });
    },
    getHighlighted: async ctx => {
        const highlighted_posts = await strapi.services.posts.getHighlighted()
        return highlighted_posts.map(post => sanitizeEntity(post, { model: strapi.models.posts }))
    },
    latestByCategory: async ctx => {
        const posts = await strapi.services.posts.getLatestByCategory()
        
        return posts.map(post => sanitizeEntity(post, { model: strapi.models.posts }))
    }
};
