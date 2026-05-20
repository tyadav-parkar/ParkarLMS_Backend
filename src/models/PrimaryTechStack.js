'use strict';

const { DataTypes } = require('sequelize');
const { sequelize } = require('../core/config/database');

const PrimaryTechStack = sequelize.define(
  'PrimaryTechStack',
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
      allowNull: false,
    },
    name: {
      type: DataTypes.STRING(150),
      allowNull: false,
      unique: true,
    },
    is_active: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true,
    },
  },
  {
    tableName: 'primary_tech_stacks',
    timestamps: true,
    underscored: true,
    defaultScope: {
      where: { is_active: true },
    },
  }
);

module.exports = PrimaryTechStack;
