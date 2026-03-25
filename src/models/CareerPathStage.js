'use strict';

const { DataTypes } = require('sequelize');
const { sequelize } = require('../core/config/database');

const CareerPathStage = sequelize.define(
  'CareerPathStage',
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
    stage_name: {
      type: DataTypes.STRING(255),
      allowNull: false,
    },
    designation_match: {
      type: DataTypes.STRING(255),
      allowNull: true,
    },
    band_identifier: {
      type: DataTypes.STRING(50),
      allowNull: true,
    },
    sequence_order: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    estimated_duration_months: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    required_certifications: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    description: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
  },
  {
    tableName: 'career_path_stages',
    timestamps: false,
    underscored: true,
  }
);

module.exports = CareerPathStage;
