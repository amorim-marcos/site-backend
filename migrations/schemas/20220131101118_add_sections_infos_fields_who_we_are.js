const table_name = 'who_we_ares'

exports.up = function(knex) {
    return knex.schema.alterTable(table_name, table => {       
        table.text('our_trajectory_description', 'longtext')
        table.string('where_we_are_subtitle')
        table.text('where_we_are_description', 'longtext')
        table.text('resellers_description', 'longtext')
        table.text('certifications_description', 'longtext')
    })
}

exports.down = function(knex) {
    return knex.schema.alterTable(table_name, table => {
        table.dropColumn('our_trajectory_description')
        table.dropColumn('where_we_are_subtitle')
        table.dropColumn('where_we_are_description')
        table.dropColumn('resellers_description')
        table.dropColumn('certifications_description')
    })
}