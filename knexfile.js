require('dotenv').config();

const DB_ENV = process.env.DB_ENV || "development";

const sharedConfig = {
  client: 'pg',
  connection: {
    host: process.env.PG_DB_HOST,
    user: process.env.PG_DB_USER,
    password: process.env.PG_DB_PASS,
    database: process.env.PG_DB_NAME,
    port: process.env.PG_DB_PORT,
    ssl: { rejectUnauthorized: false }
  },
  migrations: {
    directory: './src/migrations'
  },
  seeds: {
    directory: './seeds'
  }
};

module.exports = {
  development: sharedConfig,
  production: sharedConfig,
  DB_ENV
};
