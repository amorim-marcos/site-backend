'use strict';

/**
 * Read the documentation (https://strapi.io/documentation/developer-docs/latest/development/backend-customization.html#lifecycle-hooks)
 * to customize this model
 */

const MAX_HIGHLIGHTEDS = 5

module.exports = {
    lifecycles: {
        async beforeCreate(data) {
            if(!data.category){
                throw strapi.errors.badRequest(`É necessário escolher uma categoria para a publicação antes de criar.`)
            }

            if(data.is_highlighted){
                let total_highliteds = await strapi.services.posts.countHighliteds()
                if(total_highliteds >= MAX_HIGHLIGHTEDS){
                    throw strapi.errors.badRequest(`Já existem ${MAX_HIGHLIGHTEDS} publicações em destaque. Por favor, remova uma publicação dos destaques para adicionar esta publicação aos destaques.`)
                }
            }
            
            data.url_code = data.title.normalize("NFD").replace(/[^\w ]/g, "").split(' ').join('-').toLowerCase()
        },
        async beforeUpdate(params, data){
            if(data.category === null){
                throw strapi.errors.badRequest(`É necessário escolher uma categoria para a publicação.`)
            }
            
            let currentPost = await strapi.query('posts').findOne({ id: params.id })
            if(data.is_highlighted && !currentPost.is_highlighted){
                let total_highliteds = await strapi.services.posts.countHighliteds()
                if(total_highliteds >= MAX_HIGHLIGHTEDS){
                    throw strapi.errors.badRequest(`Já existem ${MAX_HIGHLIGHTEDS} publicações em destaque. Por favor, remova uma publicação dos destaques para adicionar esta publicação aos destaques.`)
                }
            }
        }
    }
};
