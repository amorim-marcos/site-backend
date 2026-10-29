const table_name = 'bp_page_banners'
const column_name = 'custom_order'

// Idempotente: o Strapi cria a coluna a partir do modelo na subida, então ela
// pode já existir quando esta migration rodar.
exports.up = async function(knex) {
    if (await knex.schema.hasColumn(table_name, column_name)) return

    await knex.schema.alterTable(table_name, table => {
        table.integer(column_name).nullable()
    })
}

exports.down = async function(knex) {
    if (!(await knex.schema.hasColumn(table_name, column_name))) return

    await knex.schema.alterTable(table_name, table => {
        table.dropColumn(column_name)
    })
}
