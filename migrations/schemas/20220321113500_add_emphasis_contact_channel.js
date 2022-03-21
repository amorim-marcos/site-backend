const table_name = "contact_channels";

exports.up = function (knex) {
  return knex.schema.alterTable(table_name, (table) => {
    // create new columns
    table.boolean("emphasis");
  });
};

exports.down = function (knex) {
  return knex.schema.alterTable(table_name, (table) => {
    // drop created columns with table.dropColumn method
    table.dropColumn("emphasis");
  });
};
