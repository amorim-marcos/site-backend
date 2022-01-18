const table_name = 'components_sawns_qualities_sawns_qualities'

exports.up = function(knex) {
    return knex.schema.hasTable(table_name).then(function(exists) {
        if(!exists){
            return knex.schema.createTable(table_name, function(table) {
                table.increments('id').unsigned().primary()
                table.integer('number', 11)
                table.string('name')
                table.string('col')
                table.text('description', 'longtext')
                table.text('uses_and_applications', 'longtext')
                table.string('thickness')
                table.string('_length')
                table.string('_width')
            });  
        }
    })
};

exports.down = function(knex) {
    return knex.schema.dropTableIfExists(table_name);  
};