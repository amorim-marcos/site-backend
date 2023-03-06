const table_name = 'bp_page_banners'

exports.up = function(knex) {
    return knex.schema.alterTable(table_name, table => {
        table.string('locale');
    })
}

exports.down = function(knex) {
    return knex.schema.alterTable(table_name, table => {
        table.dropColumn('locale')
    })
}