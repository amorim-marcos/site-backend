const table_name = 'forest_divisions'

exports.up = function(knex) {
    return knex.schema.alterTable(table_name, table => {
        table.integer('pinus_cultivation', 11)
        table.integer('planted_trees', 11)
        table.renameColumn('community_development','states')
    })
}

exports.down = function(knex) {
    return knex.schema.alterTable(table_name, table => {
        table.dropColumn('pinus_cultivation')
        table.dropColumn('planted_trees')
        table.renameColumn('states','community_development')
    })
}