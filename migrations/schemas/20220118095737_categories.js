const table_name = 'categories'

exports.up = function(knex) {
    return knex.schema.hasTable(table_name).then(function(exists) {
        if(!exists){
            return knex.schema.createTable(table_name, function(table) {
                table.increments('id').unsigned().primary()
        
                table.string('name')
                table.string('locale')
        
                table.datetime('published_at').nullable()
                table.integer('created_by').nullable()
                table.integer('updated_by').nullable()
                table.timestamps(true, true)
            });  
        }
    })
};

exports.down = function(knex) {
    return knex.schema.dropTableIfExists(table_name);  
};