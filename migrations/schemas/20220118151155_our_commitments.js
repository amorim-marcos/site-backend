const table_name = 'our_commitments'

exports.up = function(knex) {
    return knex.schema.hasTable(table_name).then(function(exists) {
        if(!exists){
            return knex.schema.createTable(table_name, function(table) {
                table.increments('id').unsigned().primary()
        
                table.text('header_text', 'longtext')
                table.string('section1_title')
                table.text('section1_text','longtext')
                table.string('section2_title')
                table.text('section2_text','longtext')
                table.decimal('carbon_sequestration')
                table.decimal('atmospheric_emissions')
                table.string('section3_title')
                table.text('section3_text','longtext')
                table.integer('cogenerated_energy', 11)
                table.integer('reused_water', 11)
                table.string('section4_title')
                table.text('section4_text','longtext')
                table.string('section5_title')
                table.text('section5_text','longtext')
                table.integer('collaborators_number', 11)
                table.string('section6_title')
                table.text('section6_text','longtext')
                table.string('section7_title')
                table.text('section7_text','longtext')
                table.text('esg_report_description','longtext')
        
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