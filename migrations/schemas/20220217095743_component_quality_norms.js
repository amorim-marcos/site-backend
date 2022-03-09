const table_name = 'components_quality_norms_quality_norms'

exports.up = function(knex) {
    return knex.schema.hasTable(table_name).then(function(exists) {
        if(!exists){
            return knex.schema.createTable(table_name, function(table) {
                table.increments('id').unsigned().primary()
                table.string('norm')
            });  
        }
    })
};

exports.down = function(knex) {
    return knex.schema.dropTableIfExists(table_name);  
};