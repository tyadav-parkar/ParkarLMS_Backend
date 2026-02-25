'use strict';

const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const ErrorLog = sequelize.define(
  'ErrorLog',
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
      allowNull: false,
    },
    error_type: {
      type: DataTypes.STRING(100),
      allowNull: true,
    },
    error_message: {
      type: DataTypes.TEXT,
      allowNull: false,
    },
    stack_trace: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    user_id: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    request_data: {
      type: DataTypes.JSONB,
      allowNull: true,
    },
    severity: {
      type: DataTypes.ENUM('low', 'medium', 'high', 'critical'),
      defaultValue: 'medium',
      allowNull: false,
    },
    is_resolved: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
      allowNull: false,
    },
  },
  {
    tableName: 'error_logs',
    timestamps: true,
    updatedAt: false,
    underscored: true,
  }
);

module.exports = ErrorLog;
