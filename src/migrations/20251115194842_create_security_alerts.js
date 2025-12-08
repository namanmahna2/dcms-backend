
exports.up = function (knex) {
  return knex.schema.createTable("security_alerts", (table) => {
    table.increments("id").primary();
    table.timestamp("created_at").defaultTo(knex.fn.now());

    table.string("type").notNullable();
    table
      .integer("issuer_id")
      .nullable()
      .references("id")
      .inTable("dcms_users")
      .onDelete("CASCADE")
      .onUpdate("CASCADE");

    table
      .integer("student_id")
      .nullable()
      .references("id")
      .inTable("dcms_students")
      .onDelete("CASCADE")
      .onUpdate("CASCADE");

    table.string("wallet_address").nullable();
    table.string("tx_hash").nullable();
    table.string("client_ip").defaultTo("");

    table.decimal("anomaly_score", 10, 4).nullable();

    table.jsonb("details").nullable();
    table.boolean("handled").defaultTo(false);
  });
};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = function (knex) {
  return knex.schema.dropTableIfExists("security_alerts");
};
