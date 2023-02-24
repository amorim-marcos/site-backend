exports.up = function(knex) {
    return knex.schema.createTable('connects', function(table) {
      table.increments('id').primary();
      table.string('youtube_video_link', 255);
      table.integer('created_by');
      table.integer('updated_by');
      table.timestamp('created_at').defaultTo(knex.fn.now());
      table.timestamp('updated_at').defaultTo(knex.fn.now());
      table.string('linkedin_link', 255);
      table.string('instagram_post_link', 255);
    });
  };
  
  exports.down = function(knex) {
    return knex.schema.dropTableIfExists('connects');
  };
  