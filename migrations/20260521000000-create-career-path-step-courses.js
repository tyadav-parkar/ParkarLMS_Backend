'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    const transaction = await queryInterface.sequelize.transaction();
    try {
      await queryInterface.createTable('career_path_step_courses', {
        id: {
          type: Sequelize.INTEGER,
          primaryKey: true,
          autoIncrement: true,
          allowNull: false,
        },
        career_path_id: {
          type: Sequelize.INTEGER,
          allowNull: false,
          references: { model: 'career_paths', key: 'id' },
          onUpdate: 'CASCADE',
          onDelete: 'CASCADE',
        },
        course_id: {
          type: Sequelize.INTEGER,
          allowNull: false,
          references: { model: 'courses', key: 'id' },
          onUpdate: 'CASCADE',
          onDelete: 'CASCADE',
        },
        created_at: {
          type: Sequelize.DATE,
          allowNull: false,
          defaultValue: Sequelize.fn('NOW'),
        },
        updated_at: {
          type: Sequelize.DATE,
          allowNull: false,
          defaultValue: Sequelize.fn('NOW'),
        },
      }, { transaction });

      await queryInterface.addConstraint('career_path_step_courses', {
        fields: ['career_path_id', 'course_id'],
        type: 'unique',
        name: 'uq_cpsc_career_path_course',
        transaction,
      });

      await queryInterface.addIndex('career_path_step_courses', ['career_path_id'], {
        name: 'idx_cpsc_career_path_id',
        transaction,
      });

      await queryInterface.addIndex('career_path_step_courses', ['course_id'], {
        name: 'idx_cpsc_course_id',
        transaction,
      });

      await transaction.commit();
    } catch (err) {
      await transaction.rollback();
      throw err;
    }
  },

  async down(queryInterface) {
    const transaction = await queryInterface.sequelize.transaction();
    try {
      await queryInterface.dropTable('career_path_step_courses', { transaction });
      await transaction.commit();
    } catch (err) {
      await transaction.rollback();
      throw err;
    }
  },
};
