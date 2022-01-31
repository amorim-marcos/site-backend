const table_name = ''

exports.up = function(knex) {
    return knex.schema.alterTable(table_name, table => {
        // create new columns
    })
}

exports.down = function(knex) {
    return knex.schema.alterTable(table_name, table => {
        // drop created columns with table.dropColumn method
    })
}