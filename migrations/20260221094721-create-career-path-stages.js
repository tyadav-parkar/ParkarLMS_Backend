'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('career_path_stages', {
      id: {
        type: Sequelize.INTEGER,
        primaryKey: true,
        autoIncrement: true,
        allowNull: false,
      },
      career_path_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: {
          model: 'career_paths',
          key: 'id',
        },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE',
      },
      stage_name: {
        type: Sequelize.STRING(255),
        allowNull: false,
      },
      designation_match: {
        type: Sequelize.STRING(255),
        allowNull: true,  // EXACT match to employees.job_title
      },
      band_identifier: {
        type: Sequelize.STRING(50),
        allowNull: true,
      },
      sequence_order: {
        type: Sequelize.INTEGER,
        allowNull: false,
      },
      estimated_duration_months: {
        type: Sequelize.INTEGER,
        allowNull: true,
      },
      required_certifications: {
        type: Sequelize.TEXT,
        allowNull: true,
      },
      description: {
        type: Sequelize.TEXT,
        allowNull: true,
      },
      // No created_at / updated_at — this table has no timestamps
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.dropTable('career_path_stages');
  },
};
