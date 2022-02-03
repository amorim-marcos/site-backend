const mdf_berneck_data = require('./data/mdf-berneck.json')

exports.seed = function(knex) {
  return knex.raw('SET FOREIGN_KEY_CHECKS=0')
    .then(async function(){
      await knex('mdf_bernecks').truncate()
        .then(function () {
          return knex('mdf_bernecks').insert(mdf_berneck_data.single_type);
        });

      await knex('mdf_bernecks_components').truncate()
        .then(function () {
          return knex('mdf_bernecks_components').insert(mdf_berneck_data.component_rel);
        });
      
      await knex('components_hdf_berneck_hdf_bernecks').truncate()
        .then(function () {
          return knex('components_hdf_berneck_hdf_bernecks').insert(mdf_berneck_data.hdf_bernecks);
        });

      await knex('components_finishes_finishes').truncate()
        .then(function () {
          return knex('components_finishes_finishes').insert(mdf_berneck_data.finishes);
        });

      await knex('components_hdf_berneck_hdf_bernecks_components').truncate()
        .then(function () {
          return knex('components_hdf_berneck_hdf_bernecks_components').insert(mdf_berneck_data.hdf_bernecks_component_rel);
        });
      
      await knex('upload_file_morph').insert(mdf_berneck_data.uploaded_files_morph)

      return knex.raw('SET FOREIGN_KEY_CHECKS=1')
    })
};
