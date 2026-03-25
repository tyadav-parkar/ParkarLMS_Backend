'use strict';

const { Op } = require('sequelize');

/**
 * admin-seed.js
 *
 * Seeds ONLY the admin employee (Tanishq Yadav — PINT099).
 * All other employees come from the Excel bulk import.
 *
 * Run order:
 *   1. npx sequelize-cli db:seed --seed roles-seed.js
 *   2. npx sequelize-cli db:seed --seed permissions-seed.js
 *   3. npx sequelize-cli db:seed --seed admin-seed.js
 *
 * Departments are NOT seeded here — they are created automatically
 * by the Excel import via getOrCreateDepartment().
 */
module.exports = {

  async up(queryInterface) {
    const now = new Date();

    /* ── Fetch admin role id ─────────────────────────────────────────────── */
    const [roles] = await queryInterface.sequelize.query(
      `SELECT id FROM roles WHERE name = 'admin' AND is_system_role = true`
    );
    if (roles.length === 0) {
      throw new Error("Role 'admin' not found — run roles-seed.js first.");
    }
    const adminRoleId = roles[0].id;

    /* ── Insert admin employee ───────────────────────────────────────────── */
    // department_id is null — admin's department will be set via Excel import
    // if needed, or can be set manually via User Management later.
    await queryInterface.bulkInsert('employees', [{
      employee_number: 'PINT099',
      first_name:      'Tanishq',
      last_name:       'Yadav',
      email:           'tyadav@parkar.in',
      department_id:   null,
      manager_id:      null,
      job_title:       'Admin',
      band_identifier: 'L5',
      is_active:       true,
      password_hash:   null,
      created_at:      now,
      updated_at:      now,
    }]);

    /* ── Fetch inserted admin id ─────────────────────────────────────────── */
    const [empRows] = await queryInterface.sequelize.query(
      `SELECT id FROM employees WHERE employee_number = 'PINT099'`
    );
    const adminEmpId = empRows[0].id;

    /* ── Assign admin role ───────────────────────────────────────────────── */
    await queryInterface.bulkInsert('employee_roles', [{
      employee_id: adminEmpId,
      role_id:     adminRoleId,
      is_primary:  true,
      assigned_at: now,
    }]);

    console.log('✅ Admin seeded: PINT099 (tyadav@parkar.in) — department will be set via Excel import');
  },

  async down(queryInterface) {
    const [empRows] = await queryInterface.sequelize.query(
      `SELECT id FROM employees WHERE employee_number = 'PINT099'`
    );
    if (empRows.length > 0) {
      await queryInterface.bulkDelete('employee_roles', {
        employee_id: { [Op.in]: empRows.map((e) => e.id) },
      });
    }
    await queryInterface.bulkDelete('employees', {
      employee_number: { [Op.in]: ['PINT099'] },
    });
  },

};