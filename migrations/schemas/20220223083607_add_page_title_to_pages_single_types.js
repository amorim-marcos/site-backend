exports.up = function(knex) {
    return Promise.all([
        knex.schema.alterTable('berneck_pinuses', table => {
            table.string('page_title')
        }),
        knex.schema.alterTable('berneck_tecas', table => {
            table.string('page_title')
        }),
        knex.schema.alterTable('forest_divisions', table => {
            table.string('page_title')
        }),
        knex.schema.alterTable('components_hdf_berneck_hdf_bernecks', table => {
            table.string('page_title')
        }),
        knex.schema.alterTable('our_commitments', table => {
            table.string('page_title')
        }),
        knex.schema.alterTable('plus_bernecks', table => {
            table.string('page_title')
        }),
        knex.schema.alterTable('who_we_ares', table => {
            table.string('page_title')
        })
    ])
}

exports.down = function(knex) {
    return Promise.all([
            knex.schema.alterTable('berneck_pinuses', table => {
                table.dropColumn('page_title')
            }),
            knex.schema.alterTable('berneck_tecas', table => {
                table.dropColumn('page_title')
            }),
            knex.schema.alterTable('forest_divisions', table => {
                table.dropColumn('page_title')
            }),
            knex.schema.alterTable('components_hdf_berneck_hdf_bernecks', table => {
                table.dropColumn('page_title')
            }),
            knex.schema.alterTable('our_commitments', table => {
                table.dropColumn('page_title')
            }),
            knex.schema.alterTable('plus_bernecks', table => {
                table.dropColumn('page_title')
            }),
            knex.schema.alterTable('who_we_ares', table => {
                table.dropColumn('page_title')
            })
    ])
}