const table_name = 'who_we_ares'

exports.up = function(knex) {
    return knex.schema.hasTable(table_name).then(function(exists) {
        if(!exists){
            return knex.schema.createTable(table_name, function(table) {
                table.increments('id').unsigned().primary()
        
                table.string('header_title')
                table.text('header_text', 'longtext')
                table.string('section1_title')
                table.text('section1_text','longtext')
                table.string('section2_title')
                table.text('section2_text','longtext')
                table.integer('exportation_volume', 11)
                table.integer('comercial_relationship', 11)
                table.string('locale')
        
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