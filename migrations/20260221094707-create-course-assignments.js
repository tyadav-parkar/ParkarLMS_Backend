'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    // Create ENUM type before table (PostgreSQL requirement)
    await queryInterface.sequelize.query(
      `CREATE TYPE "enum_course_assignments_status" AS ENUM ('assigned','in_progress','completed','cancelled')`
    );

    await queryInterface.createTable('course_assignments', {
      id: {
        type: Sequelize.INTEGER,
        primaryKey: true,
        autoIncrement: true,
        allowNull: false,
      },
      course_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: {
          model: 'courses',
          key: 'id',
        },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE',
      },
      employee_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: {
          model: 'employees',
          key: 'id',
        },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE',
      },
      assigned_by: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: {
          model: 'employees',
          key: 'id',
        },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE',
      },
      assigned_date: {
        type: Sequelize.DATEONLY,
        allowNull: true,
        defaultValue: Sequelize.fn('NOW'),
      },
      due_date: {
        type: Sequelize.DATEONLY,
        allowNull: true,
      },
      status: {
        type: Sequelize.ENUM('assigned', 'in_progress', 'completed', 'cancelled'),
        allowNull: false,
        defaultValue: 'assigned',
      },
      completion_date: {
        type: Sequelize.DATEONLY,
        allowNull: true,
      },
      notes: {
        type: Sequelize.TEXT,
        allowNull: true,
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

    // Add UNIQUE constraint on (course_id, employee_id) — no duplicate assignments
    await queryInterface.addConstraint('course_assignments', {
      fields: ['course_id', 'employee_id'],
      type: 'unique',
      name: 'unique_course_employee_assignment',
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.dropTable('course_assignments');

    // Drop ENUM type after table is dropped
    await queryInterface.sequelize.query(
      `DROP TYPE IF EXISTS "enum_course_assignments_status"`
    );
  },
};
