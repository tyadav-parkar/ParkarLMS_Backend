'use strict';

const { DataTypes } = require('sequelize');
const { sequelize } = require('../../core/config/database');

/**
 * ImportLog
 * modules/import/importLog.model.js
 *
 * Stores a full audit record for every bulk import run.
 * Table: import_logs
 */
const ImportLog = sequelize.define(
  'ImportLog',
  {
    id: {
      type:          DataTypes.INTEGER,
      primaryKey:    true,
      autoIncrement: true,
      allowNull:     false,
    },
    uploaded_by: {
      type:      DataTypes.INTEGER,
      allowNull: false,
      comment:   'FK → employees.id',
    },
    file_name: {
      type:      DataTypes.STRING(255),
      allowNull: false,
    },
    total_rows: {
      type:         DataTypes.INTEGER,
      allowNull:    false,
      defaultValue: 0,
    },
    inserted: {
      type:         DataTypes.INTEGER,
      allowNull:    false,
      defaultValue: 0,
    },
    updated: {
      type:         DataTypes.INTEGER,
      allowNull:    false,
      defaultValue: 0,
    },
    skipped: {
      type:         DataTypes.INTEGER,
      allowNull:    false,
      defaultValue: 0,
    },
    warnings: {
      type:      DataTypes.JSONB,
      allowNull: true,
      comment:   'Array of { field, message }',
    },
    errors: {
      type:      DataTypes.JSONB,
      allowNull: true,
      comment:   'Array of { row, field, message }',
    },
    status: {
      type:         DataTypes.ENUM('completed', 'completed_with_warnings', 'failed'),
      allowNull:    false,
      defaultValue: 'completed',
    },
  },
  {
    tableName:   'import_logs',
    timestamps:  true,
    underscored: true,
  }
);

module.exports = ImportLog;