const table_name = 'posts'

exports.up = function(knex) {
    return knex.schema.alterTable(table_name, table => {
        table.date('publication_date').nullable()
    })
}

exports.down = function(knex) {
    return knex.schema.alterTable(table_name, table => {
        table.dropColumn('publication_date')
    })
}