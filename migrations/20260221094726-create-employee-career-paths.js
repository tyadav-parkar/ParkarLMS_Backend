'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('employee_career_paths', {
      id: {
        type: Sequelize.INTEGER,
        primaryKey: true,
        autoIncrement: true,
        allowNull: false,
      },
      employee_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        unique: true,  // One employee has exactly one career path entry
        references: {
          model: 'employees',
          key: 'id',
        },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE',
      },
      career_path_id: {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: {
          model: 'career_paths',
          key: 'id',
        },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL',
      },
      current_stage_id: {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: {
          model: 'career_path_stages',
          key: 'id',
        },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL',
      },
      enrolled_date: {
        type: Sequelize.DATEONLY,
        allowNull: true,
      },
      is_auto_detected: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: true,
      },
      needs_review: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: false,  // true when multiple paths matched
      },
      last_updated: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.fn('NOW'),
      },
      // No created_at / updated_at — timestamps: false in the model
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.dropTable('employee_career_paths');
  },
};
