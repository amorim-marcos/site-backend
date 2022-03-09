const table_name = 'categories'

exports.up = function(knex) {
    return knex.schema.alterTable(table_name, table => {       
        table.text('description', 'longtext')
    })
}

exports.down = function(knex) {
    return knex.schema.alterTable(table_name, table => {
        table.dropColumn('description')
    })
}