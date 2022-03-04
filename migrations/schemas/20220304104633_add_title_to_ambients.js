const table_name = 'ambients'

exports.up = function(knex) {
    return knex.schema.alterTable(table_name, table => {
        table.string('title')
    })
}

exports.down = function(knex) {
    return knex.schema.alterTable(table_name, table => {
        table.dropColumn('title')
    })
}