// migrations/xxxx_create_ml_transactions_table.js

exports.up = function (knex) {
  return knex.schema.createTable("ml_transactions", function (table) {
    table.increments("id").primary();

    table.integer("degree_token_id").notNullable();
    table.string("wallet").notNullable();
    table.string("tx_hash").notNullable();
    
    table.bigInteger("timestamp").notNullable();

    table.bigInteger("gas_price").notNullable();
    table.bigInteger("gas_used").notNullable();

    table.integer("block_number").notNullable();
    table.bigInteger("block_time_diff").notNullable();
    table.integer("nonce").notNullable();

    table.string("function").notNullable();
    table.string("metadata_cid").notNullable();

    // Optional fields for ML
    table.boolean("is_anomaly").defaultTo(false);
    table.float("ml_score").defaultTo(null);

    // Timestamps
    table.timestamp("created_at").defaultTo(knex.fn.now());
  });
};

exports.down = function (knex) {
  return knex.schema.dropTable("ml_transactions");
};
