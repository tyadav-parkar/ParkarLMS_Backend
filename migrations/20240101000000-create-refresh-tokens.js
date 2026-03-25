'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('refresh_tokens', {
      id: {
        type:          Sequelize.INTEGER,
        autoIncrement: true,
        primaryKey:    true,
      },
      employee_id: {
        type:       Sequelize.INTEGER,
        allowNull:  false,
        references: { model: 'employees', key: 'id' },
        onDelete:   'CASCADE',
      },
      token: {
        type:      Sequelize.STRING(255),
        allowNull: false,
        unique:    true,
      },
      expires_at: {
        type:      Sequelize.DATE,
        allowNull: false,
      },
      is_revoked: {
        type:         Sequelize.BOOLEAN,
        defaultValue: false,
      },
      ip_address: {
        type:      Sequelize.STRING(45),
        allowNull: true,
      },
      user_agent: {
        type:      Sequelize.TEXT,
        allowNull: true,
      },
      created_at: {
        type:         Sequelize.DATE,
        defaultValue: Sequelize.NOW,
      },
    });

    await queryInterface.addIndex('refresh_tokens', ['token']);
    await queryInterface.addIndex('refresh_tokens', ['employee_id']);
  },

  async down(queryInterface) {
    await queryInterface.dropTable('refresh_tokens');
  },
};