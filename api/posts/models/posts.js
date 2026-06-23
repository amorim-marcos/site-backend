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
            // The meilisearch plugin does not remove a post from the index when it is
            // unpublished — it only skips re-adding it. We must explicitly delete it.
            // Uses the same Strapi plugin config as the meilisearch plugin itself,
            // with env var fallback, to avoid host misconfiguration in PM2 environments.
            if (!result.published_at) {
                try {
                    const { MeiliSearch } = require('meilisearch')
                    const meiliConfig = strapi.config.plugins?.meilisearch || {}
                    const client = new MeiliSearch({
                        host: meiliConfig.host || process.env.MEILI_HOST,
                        apiKey: meiliConfig.apiKey || process.env.MEILISEARCH_API_KEY,
                    })
                    strapi.log.info(`[meilisearch] removing draft post ${result.id} from index`)
                    await client.index('posts').deleteDocument(`posts-${result.id}`)
                } catch (e) {
                    strapi.log.error(`[meilisearch] draft cleanup error (posts): ${e.message}`)
                }
            }
        }
    }
};
