'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.sequelize.query(
      `CREATE TYPE "enum_error_logs_severity" AS ENUM ('low', 'medium', 'high', 'critical')`
    );

    await queryInterface.createTable('error_logs', {
      id: {
        type: Sequelize.INTEGER,
        primaryKey: true,
        autoIncrement: true,
        allowNull: false,
      },
      error_type: {
        type: Sequelize.STRING(100),
        allowNull: true,
      },
      error_message: {
        type: Sequelize.TEXT,
        allowNull: false,
      },
      stack_trace: {
        type: Sequelize.TEXT,
        allowNull: true,
      },
      user_id: {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: { model: 'employees', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL',
      },
      request_data: {
        type: Sequelize.JSONB,
        allowNull: true,
      },
      severity: {
        type: Sequelize.ENUM('low', 'medium', 'high', 'critical'),
        defaultValue: 'medium',
        allowNull: false,
      },
      is_resolved: {
        type: Sequelize.BOOLEAN,
        defaultValue: false,
        allowNull: false,
      },
      created_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.fn('NOW'),
      },
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.dropTable('error_logs');
    await queryInterface.sequelize.query(
      `DROP TYPE IF EXISTS "enum_error_logs_severity"`
    );
  },
};
