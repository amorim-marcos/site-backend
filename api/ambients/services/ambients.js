'use strict';

/**
 * Read the documentation (https://strapi.io/documentation/developer-docs/latest/development/backend-customization.html#core-services)
 * to customize this service
 */

module.exports = {
    generateSlug: async (title,number) => {
        const normalizedTitle = title.normalize("NFD").replace(/[^\w ]/g, "").split(' ').join('-').toLowerCase()

        return `${normalizedTitle}-${number}`
    },
    countWithSameTitle: async (title) => {
        const normalizedTitle = title.normalize("NFD").replace(/[^\w ]/g, "").split(' ').join('-').toLowerCase()

        const results = await strapi.query('ambients').model.query('where', 'url_code', 'LIKE', `${normalizedTitle}%`).fetch()

        if(results === null){
            return 0
        }else{
            let ambientsWithSameTitle = results.toJSON()
            if(ambientsWithSameTitle.length === undefined){
                return 1
            }else{
                return ambientsWithSameTitle.length
            }
        }
    }
};
