const table_name = 'ambient_types'

exports.up = function(knex) {
    return knex.schema.alterTable(table_name, table => {
        table.string('url_code')
    })
}

exports.down = function(knex) {
    return knex.schema.alterTable(table_name, table => {
        table.dropColumn('url_code')
    })
}