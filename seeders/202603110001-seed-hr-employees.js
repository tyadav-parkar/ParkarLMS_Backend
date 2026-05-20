'use strict';

const { Op } = require('sequelize');

/**
 * admin-seed.js
 *
 * Seeds ONLY the admin employee (Tanishq Yadav — PCG0442).
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
    const transaction = await queryInterface.sequelize.transaction();
    try {
      /* ── Fetch admin role id ─────────────────────────────────────────────── */
      const [roles] = await queryInterface.sequelize.query(
        `SELECT id FROM roles WHERE name = 'admin' AND is_system_role = true`,
        { transaction }
      );
      if (roles.length === 0) {
        throw new Error("Role 'admin' not found — run roles-seed.js first.");
      }
      const adminRoleId = roles[0].id;

      /* ── Check if admin employee exists ─────────────────────────────────── */
      const [empRows] = await queryInterface.sequelize.query(
        `SELECT id FROM employees WHERE employee_number = ?`,
        { replacements: ['PCG0442'], transaction }
      );

      let adminEmpId;
      if (empRows.length === 0) {
        /* ── Insert admin employee ───────────────────────────────────────── */
        await queryInterface.bulkInsert('employees', [{
          employee_number: 'PCG0442',
          first_name:      'Sanket',
          last_name:       'Rasal',
          email:           'srasal@parkar.in',
          department_id:   null,
          manager_id:      null,
          job_title:       'Admin',
          band_identifier: 'L5',
          is_active:       true,
          password_hash:   null,
          created_at:      now,
          updated_at:      now,
        }], { transaction });

        const [newEmpRows] = await queryInterface.sequelize.query(
          `SELECT id FROM employees WHERE employee_number = ?`,
          { replacements: ['PCG0442'], transaction }
        );
        adminEmpId = newEmpRows[0].id;
      } else {
        adminEmpId = empRows[0].id;
      }

      /* ── Assign admin role if not already assigned ─────────────────────── */
      const [assigned] = await queryInterface.sequelize.query(
        `SELECT employee_id FROM employee_roles WHERE employee_id = ? AND role_id = ? LIMIT 1`,
        { replacements: [adminEmpId, adminRoleId], transaction }
      );
      if (assigned.length === 0) {
        await queryInterface.bulkInsert('employee_roles', [{
          employee_id: adminEmpId,
          role_id:     adminRoleId,
          is_primary:  true,
          assigned_at: now,
        }], { transaction });
      }

      await transaction.commit();
      console.log('✅ Admin ensured: PCG0442 — department will be set via Excel import');
    } catch (err) {
      await transaction.rollback();
      throw err;
    }
  },

  async down(queryInterface) {
    const [empRows] = await queryInterface.sequelize.query(
      `SELECT id FROM employees WHERE employee_number = 'PCG0442'`
    );
    if (empRows.length > 0) {
      await queryInterface.bulkDelete('employee_roles', {
        employee_id: { [Op.in]: empRows.map((e) => e.id) },
      });
    }
    await queryInterface.bulkDelete('employees', {
      employee_number: { [Op.in]: ['PCG0442'] },
    });
  },

};