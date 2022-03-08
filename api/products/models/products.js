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

            const alreadyExistsProduct = await strapi.query('products').count({ url_code: data.url_code })
            
            if(alreadyExistsProduct > 0){
                throw strapi.errors.badRequest('Já existe uma combinação de nome e textura para outro BP. Por favor, introduza dados diferentes para esses campos.')
            }
        },
        async beforeUpdate(params, data){
            if(!data.product_texture){
                throw strapi.errors.badRequest('Por favor, selecione uma textura para o BP.')
            }

            const product_texture = await strapi.query('products-textures').findOne({ id: data.product_texture })

            data.complete_name = data.name + " " + product_texture.name
            data.url_code = data.complete_name.normalize("NFD").replace(/[^\w ]/g, "").split(' ').join('-').toLowerCase()

            const productsWithSameUrlCode = await strapi.query('products').find({ url_code: data.url_code })

            if(productsWithSameUrlCode.length > 1 || ( productsWithSameUrlCode.length == 1 && productsWithSameUrlCode[0].id != data.id) ){
                throw strapi.errors.badRequest('Já existe uma combinação de nome e textura para outro BP. Por favor, introduza dados diferentes para esses campos.')
            }
        },
    }
};
