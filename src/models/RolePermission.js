'use strict';

const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const RolePermission = sequelize.define(
  'RolePermission',
  {
    role_id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      allowNull: false,
    },
    permission_id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      allowNull: false,
    },
  },
  {
    tableName: 'role_permissions',
    timestamps: false, // only created_at handled at DB level
    underscored: true,
  }
);

module.exports = RolePermission;
