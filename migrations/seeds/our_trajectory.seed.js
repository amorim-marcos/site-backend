const our_trajectory_data = require('./data/our-trajectory.json')

exports.seed = function(knex) {
  return knex.raw('SET FOREIGN_KEY_CHECKS=0')
    .then(async function(){
      await knex('our_trajectories').truncate()
        .then(function () {
          return knex('our_trajectories').insert(our_trajectory_data.single_type);
        });
      
      await knex('components_trajectory_year_years').truncate()
        .then(function () {
          return knex('components_trajectory_year_years').insert(our_trajectory_data.trajectory_years);
        });

      await knex('our_trajectories_components').truncate()
        .then(function(){
          return knex('our_trajectories_components').insert(our_trajectory_data.component_rel)
        })

      await knex('upload_file_morph').insert(our_trajectory_data.uploaded_files_morph)

      return knex.raw('SET FOREIGN_KEY_CHECKS=1')
    })
};
