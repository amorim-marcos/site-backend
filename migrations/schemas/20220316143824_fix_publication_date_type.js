const table_name = 'posts'

exports.up = function(knex) {
    return knex.schema.alterTable(table_name, table => {
        table.renameColumn('publcation_date','publication_date')
    })
}

exports.down = function(knex) {
    return knex.schema.alterTable(table_name, table => {
        table.renameColumn('publication_date','publcation_date')
    })
}