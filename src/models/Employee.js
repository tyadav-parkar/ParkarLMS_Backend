'use strict';

const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const Employee = sequelize.define(
  'Employee',
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
      allowNull: false,
    },
    employee_number: {
      type: DataTypes.STRING(50),
      allowNull: false,
      unique: true,
    },
    first_name: {
      type: DataTypes.STRING(100),
      allowNull: false,
    },
    last_name: {
      type: DataTypes.STRING(100),
      allowNull: false,
    },
    email: {
      type: DataTypes.STRING(255),
      allowNull: false,
      unique: true,
    },
    department_id: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    manager_id: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    job_title: {
      type: DataTypes.STRING(150),
      allowNull: true,
    },
    band_identifier: {
      type: DataTypes.STRING(50),
      allowNull: true,
    },
    role: {
      type: DataTypes.ENUM('admin', 'manager', 'employee'),
      defaultValue: 'employee',
      allowNull: false,
    },
    is_active: {
      type: DataTypes.BOOLEAN,
      defaultValue: true,
      allowNull: false,
    },
    last_login: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    password_hash: {
      type: DataTypes.STRING(255),
      allowNull: true,
    },
    fullName: {
      type: DataTypes.VIRTUAL,
      get() {
        return `${this.first_name} ${this.last_name}`;
      },
    },
  },
  {
    tableName: 'employees',
    timestamps: true,
    underscored: true,
    defaultScope: {
      where: { is_active: true },
      attributes: { exclude: ['password_hash'] },
    },
    scopes: {
      withPassword: {
        where: { is_active: true },
      },
      withInactive: {},
    },
  }
);

Employee.prototype.toJSON = function () {
  const values = Object.assign({}, this.get());
  delete values.password_hash;
  return values;
};

module.exports = Employee;
