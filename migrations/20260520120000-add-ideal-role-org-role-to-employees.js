'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('employees', 'ideal_role_id', {
      type: Sequelize.INTEGER,
      allowNull: true,
      references: {
        model: 'ideal_roles',
        key: 'id',
      },
      onUpdate: 'CASCADE',
      onDelete: 'SET NULL',
    });

    await queryInterface.addColumn('employees', 'org_role_id', {
      type: Sequelize.INTEGER,
      allowNull: true,
      references: {
        model: 'org_roles',
        key: 'id',
      },
      onUpdate: 'CASCADE',
      onDelete: 'SET NULL',
    });
  },

  async down(queryInterface) {
    await queryInterface.removeColumn('employees', 'org_role_id');
    await queryInterface.removeColumn('employees', 'ideal_role_id');
  },
};
