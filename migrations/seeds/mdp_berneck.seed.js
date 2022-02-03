const mdp_berneck_data = require('./data/mdp-berneck.json')

exports.seed = function(knex) {
  return knex.raw('SET FOREIGN_KEY_CHECKS=0')
    .then(async function(){
      await knex('mdp_bernecks').truncate()
        .then(function () {
          return knex('mdp_bernecks').insert(mdp_berneck_data.single_type);
        });

      await knex('mdp_bernecks_components').truncate()
        .then(function () {
          return knex('mdp_bernecks_components').insert(mdp_berneck_data.component_rel);
        });

      await knex('components_hdf_berneck_hdf_bernecks').insert(mdp_berneck_data.hdf_bernecks);

      await knex('components_finishes_finishes').insert(mdp_berneck_data.finishes); 
      
      await knex('components_hdf_berneck_hdf_bernecks_components').insert(mdp_berneck_data.hdf_bernecks_component_rel);
      
      await knex('upload_file_morph').insert(mdp_berneck_data.uploaded_files_morph)

      return knex.raw('SET FOREIGN_KEY_CHECKS=1')
    })
};
