'use strict';

/**
 * Creates the employees table.
 * role_id is a nullable FK to roles (roles table exists at migration 094654).
 * It is left nullable at DB level so migrations can run without seeded data;
 * the Sequelize model enforces allowNull:false at the application layer.
 */

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('employees', {
      id: {
        type: Sequelize.INTEGER,
        primaryKey: true,
        autoIncrement: true,
        allowNull: false,
      },
      employee_number: {
        type: Sequelize.STRING(50),
        allowNull: false,
        unique: true,  // Keka upsert key
      },
      first_name: {
        type: Sequelize.STRING(100),
        allowNull: false,
      },
      last_name: {
        type: Sequelize.STRING(100),
        allowNull: false,
      },
      email: {
        type: Sequelize.STRING(255),
        allowNull: false,
        unique: true,
      },
      department_id: {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: {
          model: 'departments',
          key: 'id',
        },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL',
      },
      manager_id: {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: {
          model: 'employees',  // self-referencing
          key: 'id',
        },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL',
      },
      job_title: {
        type: Sequelize.STRING(150),
        allowNull: true,
      },
      band_identifier: {
        type: Sequelize.STRING(50),
        allowNull: true,  // e.g. GTE, L1, L2
      },
      role_id: {
        type: Sequelize.INTEGER,
        allowNull: true,  // nullable at DB level; enforced NOT NULL by Sequelize model
        references: {
          model: 'roles',
          key: 'id',
        },
        onUpdate: 'CASCADE',
        onDelete: 'RESTRICT',
      },
      is_active: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: true,
      },
      last_login: {
        type: Sequelize.DATE,
        allowNull: true,
      },
      password_hash: {
        type: Sequelize.STRING(255),
        allowNull: true,  // Always NULL — authentication is via Azure AD SSO
      },
      created_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.fn('NOW'),
      },
      updated_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.fn('NOW'),
      },
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable('employees');
  },
};
