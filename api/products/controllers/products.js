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
        const { _locale } = ctx.query;

        const products = await strapi.query('products').find({ 'locale': _locale, '_sort': 'scale:ASC' })
        const totalProducts = products.length

        const productIndex = products.findIndex((p) => p.url_code == url_code) 

        const nextIndex = (productIndex + 1) % totalProducts
        const prevIndex = (productIndex - 1 < 0) ? totalProducts - 1 : productIndex - 1

        const relatedAmbients = await strapi.query('ambients').find({ 'products.id': products[productIndex].id })
        
        const product = sanitizeEntity(products[productIndex], { model: strapi.models.products });

        product.totalWithSameName = await strapi.services.products.countWithSameName(product.name);

        product.next = sanitizeEntity(products[nextIndex], { model: strapi.models.products });
        product.prev = sanitizeEntity(products[prevIndex], { model: strapi.models.products });

        product.in_ambients = relatedAmbients.map((ambient) => sanitizeEntity(ambient, { model: strapi.models.ambients }) )

        return product
    },
};
