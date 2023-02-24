exports.up = function(knex) {
  return knex.schema.dropTableIfExists('connect');
};

exports.down = function(knex) {
  return knex.schema.createTable('connect', function(table) {
    table.increments('id').primary();
    table.text('youtube_video').nullable();
    table.integer('created_by').nullable();
    table.integer('updated_by').nullable();
    table.timestamp('created_at').defaultTo(knex.fn.now()).notNullable();
    table.timestamp('updated_at').defaultTo(knex.fn.now()).notNullable();
    table.text('instagram_post').nullable();
  });
};
