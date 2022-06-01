const table_name = "representatives_lists";

exports.up = function (knex) {
  return knex.schema.hasTable(table_name).then(function (exists) {
    if (!exists) {
      return knex.schema.createTable(table_name, function (table) {
        table.increments("id").unsigned().primary();

        /**
         * The content fields come here
         */

        table.string("locale");

        // table.datetime('published_at').nullable() // only use if draft system is enabled.
        table.integer("created_by").nullable();
        table.integer("updated_by").nullable();
        table.timestamps(true, true);
      });
    }
  });
};

exports.down = function (knex) {
  return knex.schema.dropTableIfExists(table_name);
};
