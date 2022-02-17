const products_data = require('./data/products.json')

exports.seed = function(knex) {
  return knex.raw('SET FOREIGN_KEY_CHECKS=0')
    .then(async function(){
      await knex('products').truncate()
        .then(function () {
          return knex('products').insert(products_data.collections);
        })
        
      await knex('product_collections').truncate()
        .then(function () {
          return knex('product_collections').insert(products_data.product_collections);
        })

      await knex('product_colorations').truncate()
        .then(function () {
          return knex('product_colorations').insert(products_data.product_colorations);
        })

      await knex('products_textures').truncate()
        .then(function () {
          return knex('products_textures').insert(products_data.product_textures);
        })

      await knex('products__product_collections').truncate()
        .then(function () {
          return knex('products__product_collections').insert(products_data.product_collection_rel);
        })

      await knex('products__combine_with').truncate()
        .then(function () {
          return knex('products__combine_with').insert(products_data.combine_with);
        })
        
      await knex('panel_types').truncate()
        .then(function () {
          return knex('panel_types').insert(products_data.panel_types);
        })

      await knex('components_available_at_available_ats').truncate()
        .then(function () {
            return knex('components_available_at_available_ats').insert(products_data.available_ats);
        });

      await knex('products_components').truncate()
        .then(function () {
          return knex('products_components').insert(products_data.component_rel);
        });
      return knex.raw('SET FOREIGN_KEY_CHECKS=1')
    })
};
