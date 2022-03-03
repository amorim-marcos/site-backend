const table_name = 'products'

exports.up = function(knex) {
    return knex.schema.alterTable(table_name, table => {
        table.text('uses_and_applications', 'longtext')
    })
}

exports.down = function(knex) {
    return knex.schema.alterTable(table_name, table => {
        table.dropColumn('uses_and_applications')
    })
}