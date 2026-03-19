const table_name = 'bp_page_banners'

exports.up = function(knex) {
    return knex.schema.alterTable(table_name, table => {
        table.integer('custom_order').nullable()
    })
}

exports.down = function(knex) {
    return knex.schema.alterTable(table_name, table => {
        table.dropColumn('custom_order')
    })
}
