exports.up = function(knex) {
  return knex.schema.table('product_collections', function(table) {
    table.date('release_date').nullable();
  });
};

exports.down = function(knex) {
  return knex.schema.table('product_collections', function(table) {
    table.dropColumn('release_date');
  });
};
