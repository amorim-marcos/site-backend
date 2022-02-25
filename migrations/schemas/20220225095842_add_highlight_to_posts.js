const table_name = 'posts'

exports.up = function(knex) {
    return knex.schema.alterTable(table_name, table => {
        table.tinyint('is_highlighted')
    })
}

exports.down = function(knex) {
    return knex.schema.alterTable(table_name, table => {
        table.dropColumn('is_highlighted')
    })
}