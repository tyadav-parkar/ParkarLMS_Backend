'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface) {
    const now = new Date();
    // NOTE: No 'permissions' column — that moved to the role_permissions junction table.
    await queryInterface.bulkInsert('roles', [
      {
        name:           'admin',
        description:    'Full access to all features',
        is_system_role: true,
        created_at:     now,
        updated_at:     now,
      },
      {
        name:           'manager',
        description:    'Team management and course assignment',
        is_system_role: true,
        created_at:     now,
        updated_at:     now,
      },
      {
        name:           'employee',
        description:    'Self-access only — view own data',
        is_system_role: true,
        created_at:     now,
        updated_at:     now,
      },
    ], { ignoreDuplicates: true });
  },

  async down(queryInterface) {
    await queryInterface.bulkDelete('roles', {
      name: ['admin', 'manager', 'employee'],
    }, {});
  },
};
