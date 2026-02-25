'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    // Dynamically fetch department IDs (not hardcoded)
    const [depts] = await queryInterface.sequelize.query(
      'SELECT id, code FROM departments'
    );
    const deptMap = {};
    depts.forEach((d) => {
      deptMap[d.code] = d.id;
    });

    await queryInterface.bulkInsert('employees', [
      {
        employee_number: 'PINT099',
        first_name: 'Tanishq',
        last_name: 'Yadav',
        email: 'tyadav@parkar.in',
        department_id: deptMap['DE'],
        manager_id: null,
        job_title: 'Senior Data Engineer',
        band_identifier: 'L3',
        role: 'admin',
        is_active: true,
        password_hash: null,
        created_at: new Date(),
        updated_at: new Date(),
      },
      {
        employee_number: 'PINT096',
        first_name: 'Manager',
        last_name: 'Test',
        email: 'asingh4@parkar.in',
        department_id: deptMap['DE'],
        manager_id: null,
        job_title: 'Lead Data Engineer',
        band_identifier: 'L4',
        role: 'manager',
        is_active: true,
        password_hash: null,
        created_at: new Date(),
        updated_at: new Date(),
      },
      {
        employee_number: 'PINT091',
        first_name: 'Employee',
        last_name: 'Test',
        email: 'bchoudhary@parkar.in',
        department_id: deptMap['SE'],
        manager_id: null,
        job_title: 'Application Developer',
        band_identifier: 'L1',
        role: 'employee',
        is_active: true,
        password_hash: null,
        created_at: new Date(),
        updated_at: new Date(),
      },
    ]);
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.bulkDelete('employees', {
      employee_number: ['PINT099', 'PINT096', 'PINT091', 'PINT093'],
    });
  },
};
