'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('employees', 'primary_tech_stack_id', {
      type: Sequelize.INTEGER,
      allowNull: true,
      references: {
        model: 'primary_tech_stacks',
        key: 'id',
      },
      onUpdate: 'CASCADE',
      onDelete: 'SET NULL',
    });
  },

  async down(queryInterface) {
    await queryInterface.removeColumn('employees', 'primary_tech_stack_id');
  },
};
