'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('employees', 'current_career_path_id', {
      type: Sequelize.INTEGER,
      allowNull: true,
      references: { model: 'career_paths', key: 'id' },
      onUpdate: 'CASCADE',
      onDelete: 'SET NULL',
    });
  },

  async down(queryInterface) {
    await queryInterface.removeColumn('employees', 'current_career_path_id');
  },
};
