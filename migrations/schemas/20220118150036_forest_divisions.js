const table_name = ''

exports.up = function(knex) {
    return knex.schema.hasTable(table_name).then(function(exists) {
        if(!exists){
            return knex.schema.createTable(table_name, function(table) {
                table.increments('id').unsigned().primary()
        
                table.text('header_text', 'longtext')
                table.string('section1_title')
                table.string('section1_text')
                table.integer('planted_forests', 11)
                table.integer('preserved_native_forests', 11)
                table.integer('value_chain_counties', 11)
                table.integer('community_development', 11)
                table.string('section2_title')
                table.text('section2_text', 'longtext')
                table.string('section3_title')
                table.text('section3_text', 'longtext')
                table.integer('monitored_farms', 11)
                table.integer('monitored_animals', 11)
                table.string('monitored_animals_and_farms_text')
                table.string('section4_title')
                table.text('section4_text', 'longtext')
                table.string('section5_title')
                table.string('section5_text')
                table.string('section6_title')
                table.text('section6_text', 'longtext')
        
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