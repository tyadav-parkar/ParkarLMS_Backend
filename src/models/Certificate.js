'use strict';

const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const Certificate = sequelize.define(
  'Certificate',
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
    },
    certificate_name: {
      type: DataTypes.STRING(255),
      allowNull: false,
    },
    issuing_organization: {
      type: DataTypes.STRING(255),
      allowNull: true,
    },
    certificate_number: {
      type: DataTypes.STRING(100),
      allowNull: true,
    },
    issue_date: {
      type: DataTypes.DATEONLY,
      allowNull: true,
    },
    expiry_date: {
      type: DataTypes.DATEONLY,
      allowNull: true,
    },
    sync_source: {
      type: DataTypes.STRING(50),
      defaultValue: 'keka_excel',
    },
  },
  {
    tableName: 'certificates',
    timestamps: true,
    underscored: true,
  }
);

module.exports = Certificate;
