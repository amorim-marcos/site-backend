const table_name = 'components_hdf_berneck_hdf_bernecks'

exports.up = function(knex) {
    return knex.schema.hasTable(table_name).then(function(exists) {
        if(!exists){
            return knex.schema.createTable(table_name, function(table) {
                table.increments('id').unsigned().primary()
                table.text('subtitle_description','longtext')
                table.string('_width')
                table.string('_length')
                table.text('uses_and_applications','longtext')
                table.string('thickness')
                table.string('subtitle')
                table.text('description','longtext')
            });  
        }
    })
};

exports.down = function(knex) {
    return knex.schema.dropTableIfExists(table_name);  
};