const table_name = 'plus_bernecks'

exports.up = function(knex) {
    return knex.raw('SET FOREIGN_KEY_CHECKS=0')
        .then(async () => {
            await knex.schema.hasColumn(table_name, 'published_at')
                .then(() => {
                    return knex.schema.alterTable(table_name, table => {
                        table.dropColumn('published_at')
                    })
                })
            return knex.raw('SET FOREIGN_KEY_CHECKS=1')
        })
}

exports.down = function(knex) {
    // It does nothing, because it should not have published at field.
}