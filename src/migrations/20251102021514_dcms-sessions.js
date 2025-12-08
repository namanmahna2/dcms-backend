const table_name = "dcms_sessions"

exports.up = function (knex) {
    return knex.schema.createTable(table_name, function (table) {
        table.increments("id").primary();

        table
            .integer("user_id")
            .notNullable()
            .references("id")
            .inTable("dcms_users")
            .onDelete("CASCADE")
            .onUpdate("CASCADE");

        table.string("role").notNullable();
        table.text("session_token").notNullable().unique();

        // IP anonymized — only first 3 octets stored (e.g. 192.168.1.x)
        table.string("ip_subnet").nullable();

        // Generic device info (no unique fingerprint)
        table.string("device_type").nullable(); // e.g., "Mobile", "Desktop"
        table.string("browser_family").nullable(); // e.g., "Chrome", "Safari"

        // Session timing
        table.timestamp("login_time").defaultTo(knex.fn.now());
        table.timestamp("logout_time").nullable();

        // Derived behavioral features
        table.integer("actions_count").defaultTo(0);
        table.decimal("avg_latency_ms", 10, 2).nullable();
        table.decimal("session_duration_sec", 10, 2).nullable();

        // Detection outcome
        table.string("risk_flag").defaultTo("normal"); // normal | suspicious | anomaly
        table.decimal("risk_score", 5, 2).nullable(); // 0–100 numeric risk

        // Legal metadata
        table.boolean("consent_granted").defaultTo(false);
        table.string("processing_basis").defaultTo("legitimate_interest");
        table.date("data_retention_until").nullable();

        table.timestamps(true, true);
    });
};

exports.down = function (knex) {
    return knex.schema.dropTableIfExists(table_name);
};
