/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = async function (knex) {
  await knex.schema.createTable('dcms_courses', (table) => {
    table.increments('id').primary();
    table.string('name').notNullable();
    table.string('code').notNullable().unique();
    table
      .integer('department_id')
      .unsigned()
      .notNullable()
      .references('id')
      .inTable('dcms_departments')
      .onUpdate('CASCADE')
      .onDelete('CASCADE');
    table.timestamps(true, true);
  });
};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = async function (knex) {
  await knex.schema.dropTableIfExists('dcms_courses');
};
