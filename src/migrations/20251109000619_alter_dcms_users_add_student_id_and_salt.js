const table_name = "dcms_users";

exports.up = function (knex) {
    return knex.schema.alterTable(table_name, function (table) {
        table
            .integer("student_id")
            .unsigned()
            .references("id")
            .inTable("dcms_students")
            .onDelete("CASCADE")
            .onUpdate("CASCADE")
            .index()
        table
            .string("salt", 255)
            .nullable()
    });
};

exports.down = function (knex) {
    return knex.schema.alterTable(table_name, function (table) {
        table.dropColumn("student_id");
        table.dropColumn("salt");
    });
};
