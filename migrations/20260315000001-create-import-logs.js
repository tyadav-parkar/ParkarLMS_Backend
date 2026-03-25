'use strict';

/**
 * Migration: create import_logs table + add indexes
 * File: database/migrations/20260315000001-create-import-logs.js
 */

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {

    await queryInterface.createTable('import_logs', {
      id: {
        type:          Sequelize.INTEGER,
        primaryKey:    true,
        autoIncrement: true,
        allowNull:     false,
      },
      uploaded_by: {
        type:       Sequelize.INTEGER,
        allowNull:  false,
        references: { model: 'employees', key: 'id' },
        onUpdate:   'CASCADE',
        onDelete:   'RESTRICT',
      },
      file_name:  { type: Sequelize.STRING(255), allowNull: false },
      total_rows: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 0 },
      inserted:   { type: Sequelize.INTEGER, allowNull: false, defaultValue: 0 },
      updated:    { type: Sequelize.INTEGER, allowNull: false, defaultValue: 0 },
      skipped:    { type: Sequelize.INTEGER, allowNull: false, defaultValue: 0 },
      warnings: {
        type:      Sequelize.JSONB,
        allowNull: true,
        comment:   'Array of { field, message } warning objects',
      },
      errors: {
        type:      Sequelize.JSONB,
        allowNull: true,
        comment:   'Array of { row, field, message } error objects',
      },
      status: {
        type:         Sequelize.ENUM('completed', 'completed_with_warnings', 'failed'),
        allowNull:    false,
        defaultValue: 'completed',
      },
      created_at: {
        type:         Sequelize.DATE,
        allowNull:    false,
        defaultValue: Sequelize.literal('NOW()'),
      },
      updated_at: {
        type:         Sequelize.DATE,
        allowNull:    false,
        defaultValue: Sequelize.literal('NOW()'),
      },
    });

    await queryInterface.addIndex('import_logs', ['uploaded_by'], {
      name: 'idx_import_logs_uploaded_by',
    });
    await queryInterface.addIndex('import_logs', ['created_at'], {
      name: 'idx_import_logs_created_at',
    });

    // Add manager_id index on employees if not already present
    try {
      await queryInterface.addIndex('employees', ['manager_id'], {
        name: 'idx_employees_manager_id',
      });
    } catch (_) {
      // Already exists — safe to ignore
    }
  },

  async down(queryInterface) {
    await queryInterface.removeIndex('employees', 'idx_employees_manager_id').catch(() => {});
    await queryInterface.dropTable('import_logs');
    await queryInterface.sequelize.query(
      `DROP TYPE IF EXISTS "enum_import_logs_status"`
    ).catch(() => {});
  },
};