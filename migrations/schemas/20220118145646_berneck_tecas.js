const table_name = 'berneck_tecas'

exports.up = function(knex) {
    return knex.schema.hasTable(table_name).then(function(exists) {
        if(!exists){
            return knex.schema.createTable(table_name, function(table) {
                table.increments('id').unsigned().primary()
        
                table.string('header_subtitle')
                table.text('header_subtitle_description', 'longtext')
                table.text('description', 'longtext')
                table.text('uses_and_applications', 'longtext')
                table.text('machinability', 'longtext')
                table.string('thickness')
                table.string('_lengh')
                table.string('_width')
        
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