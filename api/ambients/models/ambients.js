'use strict';

/**
 * Read the documentation (https://strapi.io/documentation/developer-docs/latest/development/backend-customization.html#lifecycle-hooks)
 * to customize this model
 */

module.exports = {
    lifecycles: {
        // async beforeCreate(data){
        //     // if(!data.products || data.products.length == 0){
        //     //     throw strapi.errors.badRequest(`É necessário escolher pelo menos um BP associado ao ambiente.`)
        //     // }
        // },


        // async beforeUpdate(params, data){

        async beforeUpdate(params, data){
            // if(!params.avoidHook && (!data.products || data.products.length == 0)){
            //     throw strapi.errors.badRequest(`É necessário escolher pelo menos um BP associado ao ambiente.`)
            // }

            if(params.avoidHook) delete params.avoidHook
        },
        async afterCreate(result, data) {
           const url_code = await strapi.services.ambients.generateSlug(data.title,result.id)
           await strapi.query('ambients').update({ id: result.id, avoidHook: true }, { url_code: url_code})
        }
    }
};
