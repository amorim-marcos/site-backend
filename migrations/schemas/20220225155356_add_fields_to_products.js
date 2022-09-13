const table_name = 'products'

exports.up = function(knex) {
    return knex.schema.alterTable(table_name, table => {
        table.date('launch')
        table.integer('scale', 11)
    })
}

exports.down = function(knex) {
    return knex.schema.alterTable(table_name, table => {
        table.dropColumn('launch')
        table.dropColumn('scale')
    })
}