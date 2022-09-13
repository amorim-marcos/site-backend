const originTable = 'where_we_ares'
const idName = 'where_we_are'
const table = `${originTable}_components`

exports.up = function(knex) {
    return knex.schema.hasTable(table).then(function(exists) {
        if(!exists){
            return knex.schema.createTable(table, function(table) {
                table.increments('id').unsigned().primary()
                table.string('field')
                table.integer('order').unsigned()
                table.string('component_type')
                table.integer('component_id', 11)
                table.integer(`${idName}_id`).unsigned()
                table.foreign(`${idName}_id`,`${idName}_id_fk`).references("id").inTable(originTable)
            });  
        }
    })
};

exports.down = function(knex) {
    return knex.schema.dropTableIfExists(table);  
};