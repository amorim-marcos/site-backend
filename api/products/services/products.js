'use strict';

/**
 * Read the documentation (https://strapi.io/documentation/developer-docs/latest/development/backend-customization.html#core-services)
 * to customize this service
 */

module.exports = {
    upgradeCompleteName: async (productId) => {
        const product = await strapi.query('products').findOne({ id: productId })

        const product_texture = product.product_texture

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
