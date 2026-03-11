'use strict';

require('dotenv').config();
const { Sequelize } = require('sequelize');

/* ─────────────────────────────────────────────
   Base DB config (used by CLI + app)
───────────────────────────────────────────── */
const config = {
  username: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  dialect: 'postgres',
  logging: process.env.NODE_ENV === 'production' ? false : console.log,
};

/* ─────────────────────────────────────────────
   Sequelize instance for application
───────────────────────────────────────────── */
const sequelize = new Sequelize(
  config.database,
  config.username,
  config.password,
  config
);

/* ─────────────────────────────────────────────
   Connection tester
───────────────────────────────────────────── */
async function testConnection() {
  try {
    await sequelize.authenticate();
    console.log('✅ Database connection established successfully.');
  } catch (error) {
    console.error('❌ Unable to connect to the database:', error.message);
    throw error;
  }
}

/* ─────────────────────────────────────────────
   Transaction helper
───────────────────────────────────────────── */
async function withTransaction(callback) {
  const transaction = await sequelize.transaction();
  try {
    const result = await callback(transaction);
    await transaction.commit();
    return result;
  } catch (error) {
    await transaction.rollback();
    throw {
      statusCode: 500,
      message: error.message || 'Transaction failed',
    };
  }
}

/* ─────────────────────────────────────────────
   Export for APP + SEQUELIZE CLI
───────────────────────────────────────────── */
module.exports = {
  sequelize,
  Sequelize,
  testConnection,
  withTransaction,

  development: config,
  test: config,
  production: { ...config, logging: false },
};