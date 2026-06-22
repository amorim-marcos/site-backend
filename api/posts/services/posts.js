'use strict';

/**
 * Read the documentation (https://strapi.io/documentation/developer-docs/latest/development/backend-customization.html#core-services)
 * to customize this service
 */

module.exports = {
    // Override default find/count to exclude drafts.
    // The meilisearch plugin calls services.posts.find() with no publication filter,
    // which in Strapi v3 returns all entries including drafts. This ensures only
    // published posts are indexed during bulk reindexing and other service calls.
    find: (params = {}) => {
        return strapi.query('posts').find({ published_at_null: false, ...params })
    },
    count: (params = {}) => {
        return strapi.query('posts').count({ published_at_null: false, ...params })
    },
    countHighliteds: () => {
        return strapi.query('posts').count({ is_highlighted: true })
    },
    getHighlighted: () => {
        return strapi.query('posts').find({ is_highlighted: true, published_at_null: false})
    },
    getLatestByCategory: async () => {
        const categories = await strapi.query('categories').find()
        let posts = []

        for(let category of categories){
            let firstPost = await strapi.query('posts').findOne({'category.id': category.id, '_limit': 1, "_sort": "published_at:DESC"})
            if(firstPost?.published_at != null){
                posts.push(firstPost)
            }
        }
        
        return posts
    }
};
