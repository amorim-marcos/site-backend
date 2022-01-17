const table_name = ''

exports.up = function(knex) {
    return knex.schema.createTable(table_name, function(table) {
        table.increments('id').unsigned().primary()

        /**
         * The content fields come here
         */

        table.datetime('published_at').nullable()
        table.integer('created_by').nullable()
        table.integer('updated_by').nullable()
        table.timestamps(true, true)
    });  
};

exports.down = function(knex) {
    return knex.schema.dropTable(table_name);  
};