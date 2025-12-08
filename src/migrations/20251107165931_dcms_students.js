const table_name = "dcms_students";

exports.up = function (knex) {
    return knex.schema.createTable(table_name, (table) => {
        table.increments("id").primary();

        table.string("student_id", 50).notNullable().unique(); // University-issued ID
        table.string("first_name", 100).notNullable();
        table.string("last_name", 100).nullable();
        table.string("email", 255).notNullable();
        table.string("course_name", 255).notNullable();
        table.string("department", 255).nullable();
        table.string("university_name", 255).defaultTo("Coventry University");

        // Blockchain & NFT Fields
        table.string("wallet_address", 42).notNullable().unique(); // Blockchain address
        table.string("degree_token_id").unique().nullable();       // ERC721 token ID
        table.string("ipfs_hash").nullable();                      // IPFS CID for degree file
        table.string("tx_hash").nullable();                        // Blockchain tx hash
        table.boolean("on_chain_verified").defaultTo(false);       // Synced with blockchain?

        // Security & Verification
        table.boolean("is_revoked").defaultTo(false);              // Degree revoked?
        table.string("revocation_reason").nullable();

        // Auditing
        table.timestamp("issued_at").defaultTo(knex.fn.now());
        table.timestamp("updated_at").defaultTo(knex.fn.now());
    });
};

exports.down = function (knex) {
    return knex.schema.dropTableIfExists(table_name);
};
