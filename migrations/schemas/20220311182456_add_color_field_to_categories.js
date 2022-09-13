const table_name = 'categories'

exports.up = function(knex) {
    return knex.schema.alterTable(table_name, table => {
        table.string('color')
    })
}

exports.down = function(knex) {
    return knex.schema.alterTable(table_name, table => {
        table.dropColumn('color')
    })
}