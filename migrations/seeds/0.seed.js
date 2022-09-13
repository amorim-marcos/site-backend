// Run operations that are shared by more than one seed. 
exports.seed = function(knex) {
  return knex.raw('SET FOREIGN_KEY_CHECKS=0')
    .then(async function(){
      await knex('upload_file_morph').truncate()

      // product pages
      await knex('components_hdf_berneck_hdf_bernecks').truncate()
      await knex('components_hdf_berneck_hdf_bernecks_components').truncate()
      await knex('components_finishes_finishes').truncate()
      
      return knex.raw('SET FOREIGN_KEY_CHECKS=1')
    })

};
