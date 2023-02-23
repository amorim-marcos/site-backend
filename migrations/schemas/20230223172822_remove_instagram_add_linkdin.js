exports.up = function(knex) {
    return knex.schema
      .table('connect', function(table) {
        table.dropColumn('instagram_post');
        table.text('linkedin_post').nullable();
      });
  };
  
  exports.down = function(knex) {
    return knex.schema
      .table('connect', function(table) {
        table.text('instagram_post').nullable();
        table.dropColumn('linkedin_post');
      });
  };
  