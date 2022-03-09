const table_name = 'components_trajectory_year_years'

exports.up = function(knex) {
    return knex.schema.alterTable(table_name, table => {
        table.text('description', 'longtext').alter()
    })
}

exports.down = function(knex) {
    return knex.schema.alterTable(table_name, table => {
        // not know a method to return to varchar...
    })
}