exports.up = function(knex) {
  return knex.schema.dropTableIfExists('connects');
};

exports.down = function(knex) {
  return Promise.resolve(); 
};
