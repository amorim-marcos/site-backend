'use strict';

/**
 * Read the documentation (https://strapi.io/documentation/developer-docs/latest/development/backend-customization.html#core-services)
 * to customize this service
 */

module.exports = {
    // Override default find/count to exclude drafts.
    // The meilisearch plugin calls services.products.find() with no publication filter,
    // which in Strapi v3 returns all entries including drafts. This ensures only
    // published products are indexed during bulk reindexing and other service calls.
    find: (params = {}) => {
        return strapi.query('products').find({ published_at_null: false, ...params })
    },
    count: (params = {}) => {
        return strapi.query('products').count({ published_at_null: false, ...params })
    },
    upgradeCompleteName: async (productId) => {
        const product = await strapi.query('products').findOne({ id: productId })

        const product_texture = product.product_texture ?? { name: `temporary${Math.ceil(Math.random()*100000)}` } // temporary

        const complete_name = product.name + " " + product_texture.name

        await strapi.query('products').update(
            { id: productId, avoidHook: true },
            {
                complete_name: complete_name
            }
        )
    },
    countWithSameName: async (name) => {
        const total = await strapi.query('products').count({ name_contains: name})

        return total
    }
};
