'use strict';

const { DataTypes } = require('sequelize');
const { sequelize } = require('../core/config/database');

const CareerPathStepCourse = sequelize.define(
  'CareerPathStepCourse',
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
      allowNull: false,
    },
    career_path_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    course_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
  },
  {
    tableName: 'career_path_step_courses',
    timestamps: true,
    underscored: true,
  }
);

module.exports = CareerPathStepCourse;
