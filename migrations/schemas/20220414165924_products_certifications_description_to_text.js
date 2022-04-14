const table_name = 'products_certifications'

exports.up = function(knex) {
    return knex.schema.alterTable(table_name, table => {
        table.text('description', 'longtext').alter()
    })
}

exports.down = function(knex) {
    return knex.schema.alterTable(table_name, table => {
        // drop created columns with table.dropColumn method
        // if needed to return, should avaliate how to save text parts, or if only should 
    })
}