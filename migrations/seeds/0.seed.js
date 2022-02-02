
exports.seed = function(knex) {
  return knex('upload_file_morph').truncate()
};
