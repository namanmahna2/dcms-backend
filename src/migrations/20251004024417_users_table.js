const table_name = "dcms_users";
exports.up = function (knex) {

    return knex.schema.createTbale(table_name, (table) => {
        table.increments("id").primary();
        table.string("first_name", 100).notNullable();
        table.string("last_anme");
        table.string("email", 255).notNullable().unique();
        table.string("phone").notNullable().unique();
        table.string("wallet_address", 42).unique();
        table.string("password").notNullable();
        table.enu(
            "role",
            ["student", "issuer", "verifier", "admin"],
            {
                useNative: true,
                enumName: "user_role"
            }
        ).notNullable().defaultTo("student");
        table.boolean("is_active").defaultTo(true);
        table.timestamp("created_at").defaultTo(knex.fn.now());
        table.timestamp("updated_at").defaultTo(knex.fn.now());
    })
};

exports.down = function (knex) {
    return knex.schema.dropTable(table_name);
};
