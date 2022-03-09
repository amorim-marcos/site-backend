const table_name = 'products'

exports.up = function(knex) {
    return knex.schema.alterTable(table_name, table => {
        table.string('complete_name')
    })
}

exports.down = function(knex) {
    return knex.schema.alterTable(table_name, table => {
        table.dropColumn('complete_name')
    })
}