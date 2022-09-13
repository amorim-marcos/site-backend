const table_name = 'videos'

exports.up = function(knex) {
    return knex.schema.hasTable(table_name).then(function(exists) {
        if(!exists){
            return knex.schema.createTable(table_name, function(table) {
                table.increments('id').unsigned().primary()
        
                table.string('title')
                table.string('video_url')
        
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