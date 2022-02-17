const table_name = 'plus_bernecks'

exports.up = function(knex) {
    return knex.schema.hasTable(table_name).then(function(exists) {
        if(!exists){
            return knex.schema.createTable(table_name, function(table) {
                table.increments('id').unsigned().primary()
        
                table.string('header_subtitle')
                table.text('header_text', 'longtext')
                table.text('section1_text', 'longtext')
                table.text('quality_norms_text', 'longtext')
                table.string('section1_title')
                table.text('section2_text', 'longtext')
                table.string('locale')
        
                // table.datetime('published_at').nullable() // only use if draft system is enabled.
                table.integer('created_by').nullable()
                table.integer('updated_by').nullable()
                table.timestamps(true, true)
                // table.datetime('published_at') // include it if content have draft system
            });  
        }
    })
};

exports.down = function(knex) {
    return knex.schema.dropTableIfExists(table_name);  
};