// knexfile.js
const DB_ENV = process.env.DB_ENV || "development"
module.exports = {
    development: {
        client: 'pg',
        connection: {
            host: process.env.PG_DB_HOST,
            user: process.env.PG_DB_USER,
            password: process.env.PG_DB_PASS,
            database: process.env.PG_DB_NAME,
            port: process.env.PG_DB_PORT,
            // ssl: { rejectUnauthorized: false }
            ssl: false
        },
        migrations: {
            directory: './src/migrations'
        },
        seeds: {
            directory: './seeds'
        }
    },
    DB_ENV
};
