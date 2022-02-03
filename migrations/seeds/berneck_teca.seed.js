const berneck_teca_data = require('./data/berneck-teca.json')

exports.seed = function(knex) {
  return knex.raw('SET FOREIGN_KEY_CHECKS=0')
    .then(async function(){
      await knex('berneck_tecas').truncate()
        .then(function () {
          return knex('berneck_tecas').insert(berneck_teca_data.single_type);
        });

      await knex('upload_file_morph').insert(berneck_teca_data.uploaded_files_morph)

      return knex.raw('SET FOREIGN_KEY_CHECKS=1')
    })
};
