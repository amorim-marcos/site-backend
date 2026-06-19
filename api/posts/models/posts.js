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
        },
        async afterUpdate(result) {
            // When a post is unpublished (set back to draft), the meilisearch plugin
            // does not remove it from the index — only skips re-adding it.
            // We must explicitly delete it so it stops appearing in search results.
            if (!result.published_at) {
                try {
                    const { MeiliSearch } = require('meilisearch')
                    const client = new MeiliSearch({
                        host: process.env.MEILI_HOST,
                        apiKey: process.env.MEILISEARCH_API_KEY,
                    })
                    await client.index('posts').deleteDocument(`posts-${result.id}`)
                } catch (e) {
                    console.error('Meilisearch draft cleanup error (posts):', e)
                }
            }
        }
    }
};
