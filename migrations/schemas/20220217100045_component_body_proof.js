const table_name = 'components_body_proof_body_proofs'

exports.up = function(knex) {
    return knex.schema.hasTable(table_name).then(function(exists) {
        if(!exists){
            return knex.schema.createTable(table_name, function(table) {
                table.increments('id').unsigned().primary()
                table.string('item')
                table.decimal('absorbed_water')
                table.decimal('absorption')
                table.decimal('thickness_increase')
                table.decimal('swelling')
            });  
        }
    })
};

exports.down = function(knex) {
    return knex.schema.dropTableIfExists(table_name);  
};