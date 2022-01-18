const tableA = 'posts'
const tableB = 'tags'
const idNameForTableA = 'post'
const idNameForTableB = 'tag'
const relTableName = `${tableA}__${tableB}`

exports.up = function(knex) {
    return knex.schema.hasTable(relTableName).then(function(exists) {
        if(!exists){
            return knex.schema.createTable(relTableName, function(table) {
                table.increments('id').unsigned().primary()
                table.integer(`${idNameForTableA}_id`, 11)
                table.integer(`${idNameForTableB}_id`, 11)
            });  
        }
    })
};

exports.down = function(knex) {
    return knex.schema.dropTableIfExists(relTableName);  
};