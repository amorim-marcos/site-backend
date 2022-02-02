const berneck_pinus_data = require('./data/berneck-pinus.json')

exports.seed = function(knex) {
  return knex.raw('SET FOREIGN_KEY_CHECKS=0')
    .then(async function(){
      await knex('berneck_pinuses').truncate()
        .then(function () {
          return knex('berneck_pinuses').insert(berneck_pinus_data.single_type);
        });
      
      await knex('components_sawns_qualities_sawns_qualities').truncate()
        .then(function () {
          return knex('components_sawns_qualities_sawns_qualities').insert(berneck_pinus_data.sawns_qualities);
        });
      
      await knex('berneck_pinuses_components').truncate()
        .then(function () {
          return knex('berneck_pinuses_components').insert(berneck_pinus_data.component_rel);
        });

      await knex('upload_file_morph').insert(berneck_pinus_data.uploaded_files_morph)

      return knex.raw('SET FOREIGN_KEY_CHECKS=1')
    })
};
