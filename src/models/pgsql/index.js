const knex = require('knex');
const knexfile = require('../../../knexfile');

const environment = knexfile.DB_ENV || 'development';
const config = knexfile[environment];

if (!config || !config.client) {
  throw new Error(`Knex configuration missing for environment: ${environment}`);
}

const db = knex(config);

module.exports = db;
