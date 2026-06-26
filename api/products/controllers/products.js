'use strict';
const { sanitizeEntity } = require('strapi-utils');

module.exports = {
    findOne: async ctx => {
        const { url_code } = ctx.params;
        const { _locale } = ctx.query;

        // Load all products without relations (just basic fields) to determine next/prev order
        const allProducts = await strapi.query('products').find(
            { 'locale': _locale, '_sort': 'scale:ASC' },
            [] // no relations populated — lightweight for ordering only
        );
        const totalProducts = allProducts.length;
        const productIndex = allProducts.findIndex((p) => p.url_code == url_code);

        const nextIndex = (productIndex + 1) % totalProducts;
        const prevIndex = (productIndex - 1 < 0) ? totalProducts - 1 : productIndex - 1;

        // Load only the 3 needed products with full data, in parallel
        const [currentProduct, nextProduct, prevProduct] = await Promise.all([
            strapi.query('products').findOne({ 'url_code': url_code, 'locale': _locale }),
            strapi.query('products').findOne({ 'url_code': allProducts[nextIndex].url_code, 'locale': _locale }),
            strapi.query('products').findOne({ 'url_code': allProducts[prevIndex].url_code, 'locale': _locale }),
        ]);

        const relatedAmbients = await strapi.query('ambients').find({ 'products.id': currentProduct.id });

        const product = sanitizeEntity(currentProduct, { model: strapi.models.products });

        product.totalWithSameName = await strapi.services.products.countWithSameName(product.name);

        product.next = sanitizeEntity(nextProduct, { model: strapi.models.products });
        product.prev = sanitizeEntity(prevProduct, { model: strapi.models.products });

        product.in_ambients = relatedAmbients.map((ambient) => sanitizeEntity(ambient, { model: strapi.models.ambients }));

        return product;
    },
};
