const table_name = 'components_our_place_information_our_place_informations'

exports.up = function(knex) {
    return knex.schema.hasTable(table_name).then(function(exists) {
        if(!exists){
            return knex.schema.createTable(table_name, function(table) {
                table.increments('id').unsigned().primary()
                table.text('structure', 'longtext')
                table.string('localization')
                table.string('phones')
                table.text('airport_distance', 'longtext')
            });  
        }
    })
};

exports.down = function(knex) {
    return knex.schema.dropTableIfExists(table_name);  
};