'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface) {
    // Fetch department IDs dynamically
    const [depts] = await queryInterface.sequelize.query(
      'SELECT id, code FROM departments'
    );
    const deptMap = {};
    depts.forEach((d) => { deptMap[d.code] = d.id; });

    // Fetch role IDs dynamically — M2M: role_id no longer on employees table
    const [roles] = await queryInterface.sequelize.query(
      `SELECT id, name FROM roles WHERE name IN ('admin', 'manager', 'employee')`
    );
    const roleMap = {};
    roles.forEach((r) => { roleMap[r.name] = r.id; });

    const now = new Date();

    // ── 1. Insert employees WITHOUT role_id (column dropped in M2M migration) ──
    const employees = [
      {
        employee_number: 'PINT099',
        first_name:      'Tanishq',
        last_name:       'Yadav',
        email:           'tyadav@parkar.in',
        department_id:   deptMap['DE'],
        manager_id:      null,
        job_title:       'Senior Data Engineer',
        band_identifier: 'L3',
        is_active:       true,
        password_hash:   null,
        created_at:      now,
        updated_at:      now,
      },
      {
        employee_number: 'PINT096',
        first_name:      'Manager',
        last_name:       'Test',
        email:           'asingh4@parkar.in',
        department_id:   deptMap['DE'],
        manager_id:      null,
        job_title:       'Lead Data Engineer',
        band_identifier: 'L4',
        is_active:       true,
        password_hash:   null,
        created_at:      now,
        updated_at:      now,
      },
      {
        employee_number: 'PINT091',
        first_name:      'Employee',
        last_name:       'Test',
        email:           'bchoudhary@parkar.in',
        department_id:   deptMap['SE'],
        manager_id:      null,
        job_title:       'Application Developer',
        band_identifier: 'L1',
        is_active:       true,
        password_hash:   null,
        created_at:      now,
        updated_at:      now,
      },
    ];

    await queryInterface.bulkInsert('employees', employees, { ignoreDuplicates: true });

    // ── 2. Fetch the newly inserted employee IDs ──────────────────────────────
    const [inserted] = await queryInterface.sequelize.query(
      `SELECT id, employee_number FROM employees
       WHERE employee_number IN ('PINT099', 'PINT096', 'PINT091')`
    );
    const empMap = {};
    inserted.forEach((e) => { empMap[e.employee_number] = e.id; });

    // ── 3. Insert into employee_roles junction (is_primary = TRUE for single role) ─
    const empRoleRows = [
      { employee_id: empMap['PINT099'], role_id: roleMap['admin'],    is_primary: true, assigned_at: now },
      { employee_id: empMap['PINT096'], role_id: roleMap['manager'],  is_primary: true, assigned_at: now },
      { employee_id: empMap['PINT091'], role_id: roleMap['employee'], is_primary: true, assigned_at: now },
    ].filter((r) => r.employee_id && r.role_id); // skip if lookups failed

    if (empRoleRows.length > 0) {
      await queryInterface.bulkInsert('employee_roles', empRoleRows, { ignoreDuplicates: true });
    }
  },

  async down(queryInterface) {
    await queryInterface.bulkDelete('employee_roles', {
      employee_id: queryInterface.sequelize.literal(
        `(SELECT id FROM employees WHERE employee_number IN ('PINT099','PINT096','PINT091'))`
      ),
    }, {});
    await queryInterface.bulkDelete('employees', {
      employee_number: ['PINT099', 'PINT096', 'PINT091'],
    }, {});
  },
};
