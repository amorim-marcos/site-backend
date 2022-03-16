const table_name = 'posts'

exports.up = function(knex) {
    return knex.schema.alterTable(table_name, table => {
        table.date('publcation_date').nullable()
    })
}

exports.down = function(knex) {
    return knex.schema.alterTable(table_name, table => {
        table.dropColumn('publcation_date')
    })
}