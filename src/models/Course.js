'use strict';

const { DataTypes } = require('sequelize');
const { sequelize } = require('../core/config/database');

const Course = sequelize.define(
  'Course',
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
      allowNull: false,
    },
    code: {
      type: DataTypes.STRING(50),
      allowNull: true,
      unique: true,
    },
    name: {
      type: DataTypes.STRING(255),
      allowNull: false,
    },
    provider: {
      type: DataTypes.STRING(100),
      allowNull: true,
    },
    external_url: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    category: {
      type: DataTypes.STRING(100),
      allowNull: true,
    },
    difficulty: {
      type: DataTypes.ENUM('Beginner', 'Intermediate', 'Advanced'),
      allowNull: false,
      defaultValue: 'Beginner',
    },
    estimated_duration_hours: {
      type: DataTypes.DECIMAL(5, 1),
      allowNull: true,
    },

    description: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    prerequisites: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    is_active: {
      type: DataTypes.BOOLEAN,
      defaultValue: true,
      allowNull: false,
    },
    created_by: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
  },
  {
    tableName: 'courses',
    timestamps: true,
    underscored: true,
    defaultScope: {
      where: { is_active: true },
    },
    scopes: {
      archived: { where: { is_active: false } },
      all: {},
    },
  }
);

module.exports = Course;
