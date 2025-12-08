const table = "dcms_wallets";

exports.up = function(knex) {
  return knex.schema.createTable(table, (t) => {
    t.increments("id").primary();

    t.integer("user_id").unsigned().notNullable()
      .references("id").inTable("dcms_users").onDelete("CASCADE");

    // Public address
    t.string("address", 42).notNullable().unique();

    // Custody model
    t.enu("custody", ["custodial","byo"], { useNative: true, enumName: "wallet_custody" })
      .notNullable().defaultTo("custodial");

    t.text("pk_ciphertext").nullable();       // base64
    t.string("pk_iv", 24).nullable();         // base64 12-byte IV for AES-GCM
    t.string("pk_tag", 24).nullable();        // base64 16-byte auth tag
    t.boolean("is_active").notNullable().defaultTo(true);

    t.timestamp("created_at").defaultTo(knex.fn.now());
    t.timestamp("updated_at").defaultTo(knex.fn.now());
  });
};

exports.down = function(knex) {
  return knex.schema.dropTableIfExists(table);
};
