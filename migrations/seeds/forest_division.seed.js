const forest_division_data = require('./data/forest-division.json')

exports.seed = function(knex) {
  return knex.raw('SET FOREIGN_KEY_CHECKS=0')
    .then(async function(){
      await knex('forest_divisions').truncate()
        .then(function () {
          return knex('forest_divisions').insert(forest_division_data.single_type);
        });
      
      await knex('components_public_resume_public_resumes').truncate()
        .then(function () {
          return knex('components_public_resume_public_resumes').insert(forest_division_data.public_resume);
        });

      await knex('components_forest_highlights_forest_production_highlights').truncate()
        .then(function () {
          return knex('components_forest_highlights_forest_production_highlights').insert(forest_division_data.forest_highlights);
        });
      
      await knex('forest_divisions_components').truncate()
        .then(function () {
          return knex('forest_divisions_components').insert(forest_division_data.component_rel);
        });

      await knex('upload_file_morph').insert(forest_division_data.uploaded_files_morph)

      return knex.raw('SET FOREIGN_KEY_CHECKS=1')
    })
};
