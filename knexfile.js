require('dotenv').config()

module.exports = {
  client: 'mysql',
  connection: {
    database: process.env.DATABASE_NAME,
    user:     process.env.DATABASE_USERNAME,
    password: process.env.DATABASE_PASSWORD,
    host: process.env.DATABASE_HOST
  },
  pool: {
    min: 2,
    max: 10
  },
  migrations: {
    tableName: 'knex_migrations',
    directory: 'migrations/schemas',
    // Default stub is content stub. If need other stub, using it passing as parameter.
    stub: 'migrations/stubs/content.stub.js', 
  },
  seeds: {
    directory: 'migrations/seeds'
  }
}
