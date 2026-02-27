'use strict';

/**
 * Migration: M2M Employee ↔ Roles
 *
 * UP:
 *   1. Create employee_roles junction table (employee_id, role_id, is_primary, assigned_at)
 *   2. Backfill: copy every existing employees.role_id row → employee_roles (is_primary = TRUE)
 *   3. Drop employees.role_id column
 *
 * DOWN:
 *   1. Re-add employees.role_id column (nullable)
 *   2. Restore data from employee_roles WHERE is_primary = TRUE
 *   3. Drop employee_roles table
 */

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    // ── 1. Create junction table ─────────────────────────────────────────────
    await queryInterface.createTable('employee_roles', {
      employee_id: {
        type:      Sequelize.INTEGER,
        allowNull: false,
        references: { model: 'employees', key: 'id' },
        onUpdate:  'CASCADE',
        onDelete:  'CASCADE',
      },
      role_id: {
        type:      Sequelize.INTEGER,
        allowNull: false,
        references: { model: 'roles', key: 'id' },
        onUpdate:  'CASCADE',
        onDelete:  'RESTRICT',
      },
      is_primary: {
        type:         Sequelize.BOOLEAN,
        allowNull:    false,
        defaultValue: false,
        comment:      'Exactly one row per employee should have is_primary = true',
      },
      assigned_at: {
        type:         Sequelize.DATE,
        allowNull:    false,
        defaultValue: Sequelize.fn('NOW'),
      },
    });

    // Composite primary key
    await queryInterface.addConstraint('employee_roles', {
      fields: ['employee_id', 'role_id'],
      type:   'primary key',
      name:   'employee_roles_pkey',
    });

    // ── 2. Backfill from employees.role_id ───────────────────────────────────
    await queryInterface.sequelize.query(`
      INSERT INTO employee_roles (employee_id, role_id, is_primary, assigned_at)
      SELECT id, role_id, TRUE, NOW()
      FROM employees
      WHERE role_id IS NOT NULL
      ON CONFLICT DO NOTHING
    `);

    // ── 3. Drop role_id from employees ──────────────────────────────────────
    await queryInterface.removeColumn('employees', 'role_id');
  },

  async down(queryInterface, Sequelize) {
    // ── 1. Re-add employees.role_id ──────────────────────────────────────────
    await queryInterface.addColumn('employees', 'role_id', {
      type:      Sequelize.INTEGER,
      allowNull: true,
      references: { model: 'roles', key: 'id' },
      onUpdate:  'CASCADE',
      onDelete:  'RESTRICT',
    });

    // ── 2. Restore primary role back to employees ────────────────────────────
    await queryInterface.sequelize.query(`
      UPDATE employees e
      SET role_id = er.role_id
      FROM employee_roles er
      WHERE er.employee_id = e.id
        AND er.is_primary = TRUE
    `);

    // ── 3. Drop junction table ───────────────────────────────────────────────
    await queryInterface.dropTable('employee_roles');
  },
};
