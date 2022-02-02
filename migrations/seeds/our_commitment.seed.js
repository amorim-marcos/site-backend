const our_commitment_data = require('./data/our-commitment.json')
const shell = require('shelljs');

exports.seed = function(knex) {
  return knex.raw('SET FOREIGN_KEY_CHECKS=0')
    .then(async function(){
      await knex('our_commitments').truncate()
        .then(function () {
          return knex('our_commitments').insert(our_commitment_data.single_type);
        });
      
      await knex('components_corporative_values_corporative_values').truncate()
        .then(function () {
          return knex('components_corporative_values_corporative_values').insert(our_commitment_data.corporative_values);
        });

      await knex('our_commitments_components').truncate()
        .then(function(){
          return knex('our_commitments_components').insert(our_commitment_data.component_rel)
        })

      our_commitment_data.uploaded_files.forEach((file) => {
        shell.cp(`migrations/seeds/files/${file.name}`, `public/uploads/${file.name}`)
      })

      await knex('upload_file').truncate()
        .then(function(){
          return knex('upload_file').insert(our_commitment_data.uploaded_files)
        })

      await knex('upload_file_morph').truncate()
        .then(function(){
          return knex('upload_file_morph').insert(our_commitment_data.uploaded_files_morph)
        })

      return knex.raw('SET FOREIGN_KEY_CHECKS=1')
    })
};
