'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.bulkInsert('departments', [
      {
        name: 'Data Engineering',
        code: 'DE',
        description: 'Big data, ML, BI, DataOps',
        is_active: true,
        created_at: new Date(),
        updated_at: new Date(),
      },
      {
        name: 'Software Engineering',
        code: 'SE',
        description: 'Application development and QA',
        is_active: true,
        created_at: new Date(),
        updated_at: new Date(),
      },
      {
        name: 'Platform Engineering',
        code: 'PE',
        description: 'Cloud, DevOps, SRE, Network Ops',
        is_active: true,
        created_at: new Date(),
        updated_at: new Date(),
      },
    ], { ignoreDuplicates: true });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.bulkDelete('departments', {
      code: ['DE', 'SE', 'PE'],
    });
  },
};
