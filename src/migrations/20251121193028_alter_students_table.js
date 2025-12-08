const table_name = "dcms_students";

exports.up = async function (knex) {
    // Rename issued_at → created_at
    await knex.schema.alterTable(table_name, (table) => {
        table.renameColumn("issued_at", "created_at");
    });

    // Add new issued_at column
    await knex.schema.alterTable(table_name, (table) => {
        table.timestamp("issued_at").nullable();
    });
};

exports.down = async function (knex) {
    // Remove the new issued_at column
    await knex.schema.alterTable(table_name, (table) => {
        table.dropColumn("issued_at");
    });

    // Rename created_at back → issued_at
    await knex.schema.alterTable(table_name, (table) => {
        table.renameColumn("created_at", "issued_at");
    });
};
