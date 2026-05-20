'use strict';

const { DataTypes } = require('sequelize');
const { sequelize } = require('../core/config/database');

const OrgRole = sequelize.define(
  'OrgRole',
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
      allowNull: false,
    },
    role_name: {
      type: DataTypes.STRING(150),
      allowNull: false,
    },
    is_active: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true,
    },
  },
  {
    tableName: 'org_roles',
    timestamps: true,
    underscored: true,
    defaultScope: {
      where: { is_active: true },
    },
  }
);

module.exports = OrgRole;
