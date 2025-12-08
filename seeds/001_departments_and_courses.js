/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.seed = async function (knex) {
  // Clear existing data (optional)
  await knex('dcms_courses').del();
  await knex('dcms_departments').del();

  // Insert departments
  await knex('dcms_departments').insert([
    { id: 1, name: 'Computer Science' },
    { id: 2, name: 'Electrical Engineering' },
    { id: 3, name: 'Business Administration' },
  ]);

  // Insert courses linked to departments
  await knex('dcms_courses').insert([
    // Computer Science
    { id: 1, name: 'Data Structures', code: 'CS101', department_id: 1 },
    { id: 2, name: 'Algorithms', code: 'CS102', department_id: 1 },
    { id: 3, name: 'Operating Systems', code: 'CS201', department_id: 1 },

    // Electrical Engineering
    { id: 4, name: 'Circuits and Systems', code: 'EE101', department_id: 2 },
    { id: 5, name: 'Digital Signal Processing', code: 'EE201', department_id: 2 },

    // Business Administration
    { id: 6, name: 'Marketing Principles', code: 'BA101', department_id: 3 },
    { id: 7, name: 'Financial Management', code: 'BA201', department_id: 3 },
  ]);
};
