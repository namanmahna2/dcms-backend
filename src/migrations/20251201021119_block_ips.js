exports.up = async function (knex) {
    await knex.schema.createTable("blocked_ips", (table) => {
        table.increments("id").primary();

        table.specificType("alert_ids", "integer[]").notNullable();

        table.string("ip_address", 50).notNullable();

        table.string("reason", 255).defaultTo("Automated security block");

        table.boolean("active").defaultTo(true);

        table.timestamp("created_at").defaultTo(knex.fn.now());

        table.timestamp("expires_at").nullable();
    });
};

exports.down = async function (knex) {
    await knex.schema.dropTableIfExists("blocked_ips");
};
