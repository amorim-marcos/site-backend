exports.up = function(knex) {
    return knex.schema.table('product_collections', function(table) {
      table.timestamp('release_date');
    });
  };
  
  exports.down = function(knex) {
    return knex.schema.table('product_collections', function(table) {
      table.dropColumn('release_date');
    });
  };
  