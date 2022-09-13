const plus_berneck_data = require('./data/plus-berneck.json')

exports.seed = function(knex) {
  return knex.raw('SET FOREIGN_KEY_CHECKS=0')
    .then(async function(){
      await knex('plus_bernecks').truncate()
        .then(function () {
          return knex('plus_bernecks').insert(plus_berneck_data.single_type);
        })
      
      await knex('components_quality_norms_quality_norms').truncate()
        .then(function () {
          return knex('components_quality_norms_quality_norms').insert(plus_berneck_data.quality_norms);
        });

      await knex('components_test_points_test_points').truncate()
        .then(function () {
            return knex('components_test_points_test_points').insert(plus_berneck_data.test_points);
        });
      await knex('components_important_points_important_points').truncate()
        .then(function () {
            return knex('components_important_points_important_points').insert(plus_berneck_data.important_points);
        });

      await knex('components_body_proof_body_proofs').truncate()
        .then(function () {
            return knex('components_body_proof_body_proofs').insert(plus_berneck_data.body_proof);
        });

      await knex('plus_bernecks_components').truncate()
        .then(function () {
          return knex('plus_bernecks_components').insert(plus_berneck_data.component_rel);
        });

      return knex.raw('SET FOREIGN_KEY_CHECKS=1')
    })
};
