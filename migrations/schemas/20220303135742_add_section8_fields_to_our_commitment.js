const table_name = 'our_commitments'

exports.up = function(knex) {
    return knex.schema.alterTable(table_name, table => {
        table.string('section8_title')
        table.text('section8_text', 'longtext')
    })
}

exports.down = function(knex) {
    return knex.schema.alterTable(table_name, table => {
        table.dropColumn('section8_title')
        table.dropColumn('section8_text')
    })
}