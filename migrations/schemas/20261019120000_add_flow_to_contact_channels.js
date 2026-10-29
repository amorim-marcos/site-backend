const table_name = "contact_channels";

// Identifica o fluxo de envio do canal. `ouvidoria` usa o fluxo com
// upload de arquivos; qualquer outro valor (ou nulo) segue o fluxo padrão.
//
// Idempotente de propósito: o Strapi 3 sincroniza o esquema na subida
// (`autoMigration`) e cria a coluna `flow` sozinho a partir do modelo. Se isso
// acontecer antes do `migrate:all`, uma migration que só adiciona a coluna falharia
// com "Duplicate column name" e travaria as migrations seguintes.
exports.up = async function (knex) {
  if (await knex.schema.hasColumn(table_name, "flow")) return;

  await knex.schema.alterTable(table_name, (table) => {
    table.string("flow").nullable().defaultTo("default");
  });
};

exports.down = async function (knex) {
  if (!(await knex.schema.hasColumn(table_name, "flow"))) return;

  await knex.schema.alterTable(table_name, (table) => {
    table.dropColumn("flow");
  });
};
