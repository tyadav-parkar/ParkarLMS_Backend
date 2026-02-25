'use strict';

const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const CourseAssignment = sequelize.define(
  'CourseAssignment',
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
      allowNull: false,
    },
    course_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    employee_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    assigned_by: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    assigned_date: {
      type: DataTypes.DATEONLY,
      defaultValue: DataTypes.NOW,
    },
    due_date: {
      type: DataTypes.DATEONLY,
      allowNull: true,
    },
    status: {
      type: DataTypes.ENUM('assigned', 'in_progress', 'completed', 'cancelled'),
      defaultValue: 'assigned',
      allowNull: false,
    },
    completion_date: {
      type: DataTypes.DATEONLY,
      allowNull: true,
    },
    notes: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
  },
  {
    tableName: 'course_assignments',
    timestamps: true,
    underscored: true,
  }
);

module.exports = CourseAssignment;
