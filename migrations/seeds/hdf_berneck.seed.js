const hdf_berneck_data = require('./data/hdf-berneck.json')

exports.seed = function(knex) {
  return knex.raw('SET FOREIGN_KEY_CHECKS=0')
    .then(async function(){
      await knex('hdf_bernecks').truncate()
        .then(function () {
          return knex('hdf_bernecks').insert(hdf_berneck_data.single_type);
        });

      await knex('hdf_bernecks_components').truncate()
        .then(function () {
          return knex('hdf_bernecks_components').insert(hdf_berneck_data.component_rel);
        });
      
      await knex('components_hdf_berneck_hdf_bernecks').insert(hdf_berneck_data.hdf_bernecks);

      await knex('components_finishes_finishes').insert(hdf_berneck_data.finishes);

      await knex('components_hdf_berneck_hdf_bernecks_components').insert(hdf_berneck_data.hdf_bernecks_component_rel);
      
      await knex('upload_file_morph').insert(hdf_berneck_data.uploaded_files_morph)

      return knex.raw('SET FOREIGN_KEY_CHECKS=1')
    })
};
