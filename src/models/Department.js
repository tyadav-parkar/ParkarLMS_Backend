'use strict';

const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const Department = sequelize.define(
  'Department',
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
      allowNull: false,
    },
    name: {
      type: DataTypes.STRING(100),
      allowNull: false,
      unique: true,
    },
    code: {
      type: DataTypes.STRING(20),
      allowNull: true,
      unique: true,
    },
    description: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    is_active: {
      type: DataTypes.BOOLEAN,
      defaultValue: true,
      allowNull: false,
    },
  },
  {
    tableName: 'departments',
    timestamps: true,
    underscored: true,
    defaultScope: {
      where: { is_active: true },
    },
    scopes: {
      withInactive: {},
    },
  }
);

module.exports = Department;
