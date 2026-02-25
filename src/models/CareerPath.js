'use strict';

const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const CareerPath = sequelize.define(
  'CareerPath',
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
      allowNull: false,
    },
    name: {
      type: DataTypes.STRING(255),
      allowNull: false,
    },
    department_id: {
      type: DataTypes.INTEGER,
      allowNull: true,
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
    tableName: 'career_paths',
    timestamps: true,
    underscored: true,
    defaultScope: {
      where: { is_active: true },
    },
  }
);

module.exports = CareerPath;
