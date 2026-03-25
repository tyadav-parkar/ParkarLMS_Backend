'use strict';

const { DataTypes } = require('sequelize');
const { sequelize } = require('../core/config/database');

const EmployeeCareerPath = sequelize.define(
  'EmployeeCareerPath',
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
      allowNull: false,
    },
    employee_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      unique: true,
    },
    career_path_id: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    current_stage_id: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    enrolled_date: {
      type: DataTypes.DATEONLY,
      allowNull: true,
    },
    is_auto_detected: {
      type: DataTypes.BOOLEAN,
      defaultValue: true,
    },
    needs_review: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
    },
    last_updated: {
      type: DataTypes.DATE,
      defaultValue: DataTypes.NOW,
    },
  },
  {
    tableName: 'employee_career_paths',
    timestamps: false,
    underscored: true,
  }
);

module.exports = EmployeeCareerPath;
