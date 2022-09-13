const table_name = 'certifications'

exports.up = function(knex) {
    return knex.schema.alterTable(table_name, table => {
        table.text('header_text', 'longtext').alter()
    })
}

exports.down = async function(knex) {
    await knex.schema.alterTable(table_name, table => {
        table.dropColumn('header_text')
    })

    return knex.schema.alterTable(table_name, table => {
        table.string('header_text')
    })
}