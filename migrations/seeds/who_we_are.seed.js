const table_name = 'who_we_ares'
const who_we_are_data = require('./data/who-we-are.json')

exports.seed = function(knex) {
  // Deletes ALL existing entries
  return knex(table_name).truncate()
    .then(function () {
      // Inserts seed entries
      return knex(table_name).insert(who_we_are_data);
    });
};
