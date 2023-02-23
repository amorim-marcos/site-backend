exports.up = function(knex) {
    return knex.schema.table('connects', function(table) {
      table.dropColumn('instagram_post_link');
    });
  };
  
  exports.down = function(knex) {
    return knex.schema.table('connects', function(table) {
      table.string('instagram_post_link');
    });
  };
  