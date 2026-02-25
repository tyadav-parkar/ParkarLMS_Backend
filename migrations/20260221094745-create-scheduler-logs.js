'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.sequelize.query(
      `CREATE TYPE "enum_scheduler_logs_status" AS ENUM ('pending', 'running', 'success', 'failed')`
    );

    await queryInterface.createTable('scheduler_logs', {
      id: {
        type: Sequelize.INTEGER,
        primaryKey: true,
        autoIncrement: true,
        allowNull: false,
      },
      job_name: {
        type: Sequelize.STRING(100),
        allowNull: false,
      },
      scheduled_time: {
        type: Sequelize.DATE,
        allowNull: true,
      },
      started_at: {
        type: Sequelize.DATE,
        allowNull: true,
      },
      completed_at: {
        type: Sequelize.DATE,
        allowNull: true,
      },
      status: {
        type: Sequelize.ENUM('pending', 'running', 'success', 'failed'),
        defaultValue: 'pending',
        allowNull: false,
      },
      duration_seconds: {
        type: Sequelize.DECIMAL(8, 2),
        allowNull: true,
      },
      records_processed: {
        type: Sequelize.INTEGER,
        defaultValue: 0,
        allowNull: false,
      },
      records_updated: {
        type: Sequelize.INTEGER,
        defaultValue: 0,
        allowNull: false,
      },
      records_created: {
        type: Sequelize.INTEGER,
        defaultValue: 0,
        allowNull: false,
      },
      records_skipped: {
        type: Sequelize.INTEGER,
        defaultValue: 0,
        allowNull: false,
      },
      error_message: {
        type: Sequelize.TEXT,
        allowNull: true,
      },
      created_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.fn('NOW'),
      },
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.dropTable('scheduler_logs');
    await queryInterface.sequelize.query(
      `DROP TYPE IF EXISTS "enum_scheduler_logs_status"`
    );
  },
};
