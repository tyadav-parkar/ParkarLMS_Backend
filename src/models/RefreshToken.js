'use strict';

const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const RefreshToken = sequelize.define(
  'RefreshToken',
  {
    id: {
      type:          DataTypes.INTEGER,
      primaryKey:    true,
      autoIncrement: true,
      allowNull:     false,
    },
    employee_id: {
      type:      DataTypes.INTEGER,
      allowNull: false,
    },
    token: {
      type:      DataTypes.STRING(255),
      allowNull: false,
      unique:    true,
    },
    expires_at: {
      type:      DataTypes.DATE,
      allowNull: false,
    },
    is_revoked: {
      type:         DataTypes.BOOLEAN,
      defaultValue: false,
      allowNull:    false,
    },
    ip_address: {
      type:      DataTypes.STRING(45),
      allowNull: true,
    },
    user_agent: {
      type:      DataTypes.TEXT,
      allowNull: true,
    },
  },
  {
    tableName:   'refresh_tokens',
    timestamps:  false,
    underscored: true,
  }
);

module.exports = RefreshToken;