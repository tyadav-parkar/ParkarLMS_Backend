'use strict';

const { DataTypes } = require('sequelize');
const { sequelize } = require('../../../core/config/database');

const ActivityLog = sequelize.define(
  'ActivityLog',
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
      allowNull: false,
    },
    employee_id: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    action_type: {
      type: DataTypes.STRING(100),
      allowNull: false,
    },
    action_description: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    target_type: {
      type: DataTypes.STRING(50),
      allowNull: true,
    },
    target_id: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    metadata: {
      type: DataTypes.JSONB,
      allowNull: true,
    },
    ip_address: {
      type: DataTypes.STRING(45),
      allowNull: true,
    },
    user_agent: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
  },
  {
    tableName: 'activity_logs',
    timestamps: true,
    updatedAt: false,
    underscored: true,
  }
);

module.exports = ActivityLog;