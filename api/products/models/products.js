'use strict';

/**
 * Read the documentation (https://strapi.io/documentation/developer-docs/latest/development/backend-customization.html#lifecycle-hooks)
 * to customize this model
 */

module.exports = {
    lifecycles: {
        async beforeCreate(data) {
            if(!data.product_texture){
                throw strapi.errors.badRequest('Por favor, selecione uma textura para o BP.')
            }

            const product_texture = await strapi.query('products-textures').findOne({ id: data.product_texture })

            data.complete_name = data.name + " " + product_texture.name

            data.url_code = data.complete_name.normalize("NFD").replace(/[^\w ]/g, "").split(' ').join('-').toLowerCase()
        },
        async beforeUpdate(params, data){
            if(!data.product_texture){
                throw strapi.errors.badRequest('Por favor, selecione uma textura para o BP.')
            }

            const product_texture = await strapi.query('products-textures').findOne({ id: data.product_texture })

            data.complete_name = data.name + " " + product_texture.name
            data.url_code = data.complete_name.normalize("NFD").replace(/[^\w ]/g, "").split(' ').join('-').toLowerCase()
        },
    }
};
