const table_name = 'where_we_ares'

exports.up = function(knex) {
    return knex.schema.alterTable(table_name, table => {
        table.string('latitude')
        table.string('longitude')
        table.dropColumn('google_maps_url')
    })
}

exports.down = function(knex) {
    return knex.schema.alterTable(table_name, table => {
        table.dropColumn('latitude')
        table.dropColumn('longitude')
        table.text('google_maps_url', 'longtext')
    })
}