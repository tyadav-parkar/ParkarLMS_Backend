'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    const transaction = await queryInterface.sequelize.transaction();
    try {
      // Drop existing tables if they exist (reverse FK dependency order)
      try {
        await queryInterface.sequelize.query(
          `DROP TABLE IF EXISTS career_paths CASCADE`,
          { transaction }
        );
      } catch (e) {
        // ignore
      }

      try {
        await queryInterface.sequelize.query(
          `DROP TABLE IF EXISTS ideal_roles CASCADE`,
          { transaction }
        );
      } catch (e) {
        // ignore
      }

      // Create ideal_roles table fresh
      await queryInterface.createTable('ideal_roles', {
        id: {
          type: Sequelize.INTEGER,
          primaryKey: true,
          autoIncrement: true,
          allowNull: false,
        },
        department_id: {
          type: Sequelize.INTEGER,
          allowNull: false,
          references: {
            model: 'departments',
            key: 'id',
          },
          onUpdate: 'CASCADE',
          onDelete: 'CASCADE',
        },
        role_name: {
          type: Sequelize.STRING(150),
          allowNull: false,
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

      // Index on department_id for ideal_roles
      await queryInterface.addIndex('ideal_roles', ['department_id'], {
        name: 'idx_ideal_roles_department_id',
        transaction,
      });

      // Create career_paths table fresh
      await queryInterface.createTable('career_paths', {
        id: {
          type: Sequelize.INTEGER,
          primaryKey: true,
          autoIncrement: true,
          allowNull: false,
        },
        ideal_role_id: {
          type: Sequelize.INTEGER,
          allowNull: false,
          references: {
            model: 'ideal_roles',
            key: 'id',
          },
          onUpdate: 'CASCADE',
          onDelete: 'CASCADE',
        },
        step_order: {
          type: Sequelize.INTEGER,
          allowNull: false,
        },
        role_title: {
          type: Sequelize.STRING(150),
          allowNull: false,
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

      // Unique constraint on (ideal_role_id, step_order)
      await queryInterface.addConstraint('career_paths', {
        fields: ['ideal_role_id', 'step_order'],
        type: 'unique',
        name: 'uq_career_paths_ideal_role_step_order',
        transaction,
      });

      // Index on ideal_role_id for career_paths
      await queryInterface.addIndex('career_paths', ['ideal_role_id'], {
        name: 'idx_career_paths_ideal_role_id',
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
      try {
        await queryInterface.removeIndex('career_paths', 'idx_career_paths_ideal_role_id', { transaction });
      } catch (e) {}

      try {
        await queryInterface.removeConstraint('career_paths', 'uq_career_paths_ideal_role_step_order', { transaction });
      } catch (e) {}

      await queryInterface.dropTable('career_paths', { transaction });

      try {
        await queryInterface.removeIndex('ideal_roles', 'idx_ideal_roles_department_id', { transaction });
      } catch (e) {}

      await queryInterface.dropTable('ideal_roles', { transaction });

      await transaction.commit();
    } catch (err) {
      await transaction.rollback();
      throw err;
    }
  },
};
