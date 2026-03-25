'use strict';

const { DataTypes } = require('sequelize');
const { sequelize } = require('../../../core/config/database');

const SchedulerLog = sequelize.define(
  'SchedulerLog',
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
      allowNull: false,
    },
    job_name: {
      type: DataTypes.STRING(100),
      allowNull: false,
    },
    scheduled_time: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    started_at: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    completed_at: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    status: {
      type: DataTypes.ENUM('pending', 'running', 'success', 'failed'),
      defaultValue: 'pending',
      allowNull: false,
    },
    duration_seconds: {
      type: DataTypes.DECIMAL(8, 2),
      allowNull: true,
    },
    records_processed: {
      type: DataTypes.INTEGER,
      defaultValue: 0,
      allowNull: false,
    },
    records_updated: {
      type: DataTypes.INTEGER,
      defaultValue: 0,
      allowNull: false,
    },
    records_created: {
      type: DataTypes.INTEGER,
      defaultValue: 0,
      allowNull: false,
    },
    records_skipped: {
      type: DataTypes.INTEGER,
      defaultValue: 0,
      allowNull: false,
    },
    error_message: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
  },
  {
    tableName: 'scheduler_logs',
    timestamps: true,
    updatedAt: false,
    underscored: true,
  }
);

/**
 * Usage (future scheduler jobs):
 * await SchedulerLog.create({
 *   job_name: 'nightly-sync',
 *   scheduled_time: new Date(),
 *   status: 'running',
 * });
 */

module.exports = SchedulerLog;