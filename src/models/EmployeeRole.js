'use strict';

/**
 * EmployeeRole — junction table for the M2M between Employee ↔ Role.
 *
 * Schema:
 *   employee_id  FK → employees.id   ON DELETE CASCADE
 *   role_id      FK → roles.id        ON DELETE RESTRICT
 *   is_primary   BOOLEAN — exactly one row per employee should be true;
 *                          used to derive the single "primary role" string
 *                          stored in the JWT for dashboard routing.
 *   assigned_at  TIMESTAMP
 *
 * Composite PK: (employee_id, role_id) — one row per unique pair.
 */

const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const EmployeeRole = sequelize.define(
  'EmployeeRole',
  {
    employee_id: {
      type:       DataTypes.INTEGER,
      primaryKey: true,
      allowNull:  false,
      references: { model: 'employees', key: 'id' },
      onUpdate:   'CASCADE',
      onDelete:   'CASCADE',
    },
    role_id: {
      type:       DataTypes.INTEGER,
      primaryKey: true,
      allowNull:  false,
      references: { model: 'roles', key: 'id' },
      onUpdate:   'CASCADE',
      onDelete:   'RESTRICT',
    },
    is_primary: {
      type:         DataTypes.BOOLEAN,
      defaultValue: false,
      allowNull:    false,
      comment:      'Only ONE row per employee should have is_primary = true',
    },
    assigned_at: {
      type:         DataTypes.DATE,
      defaultValue: DataTypes.NOW,
      allowNull:    false,
    },
  },
  {
    tableName:  'employee_roles',
    timestamps: false,
    underscored: true,
  }
);

module.exports = EmployeeRole;
