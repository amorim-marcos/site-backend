const table_name = "our_commitments";

exports.up = function (knex) {
  return knex.schema.alterTable(table_name, (table) => {
    // create new columns
    table.dropColumn("section8_title");
    table.dropColumn("section8_text");
  });
};

exports.down = function (knex) {
  return knex.schema.alterTable(table_name, (table) => {
    // drop created columns with table.dropColumn method
    table.text("section8_title");
    table.text("section8_text", "longtext");
  });
};
