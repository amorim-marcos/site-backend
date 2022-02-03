const table_name = 'forest_divisions'

exports.up = function(knex) {
    return knex.schema.alterTable(table_name, table => {
        table.text('section1_text', 'longtext').alter()
        table.text('section5_text', 'longtext').alter()
    })
}

exports.down = function(knex) {
    return knex.schema.alterTable(table_name, table => {
        table.string('section1_text').alter()
        table.string('section5_text').alter()
    })
}