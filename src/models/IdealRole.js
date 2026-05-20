'use strict';

const { DataTypes } = require('sequelize');
const { sequelize } = require('../core/config/database');

const IdealRole = sequelize.define(
  'IdealRole',
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
      allowNull: false,
    },
    department_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    role_name: {
      type: DataTypes.STRING(150),
      allowNull: false,
    },
  },
  {
    tableName: 'ideal_roles',
    timestamps: true,
    underscored: true,
  }
);

module.exports = IdealRole;
