exports.up = function(knex) {
  return knex.schema.createTable('connects', function(table) {
    table.increments('id').primary();
    table.string('youtube_video_link', 255).nullable(); 
    table.integer('created_by').nullable();
    table.integer('updated_by').nullable(); 
    table.timestamp('created_at').defaultTo(knex.fn.now());
    table.timestamp('updated_at').defaultTo(knex.fn.now());
    table.string('linkedin_link', 255).nullable();
  });
};

exports.down = function(knex) {
  return knex.schema.dropTableIfExists('connects');
};
