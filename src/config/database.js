'use strict';

require('dotenv').config();

const { Sequelize } = require('sequelize');

const config = {
  username: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  dialect: 'postgres',
  logging: process.env.NODE_ENV === 'production' ? false : console.log,
  pool: {
    max: 10,
    min: 0,
    acquire: 30000,
    idle: 10000,
  },
};

const sequelize = new Sequelize(
  process.env.DB_NAME,
  process.env.DB_USER,
  process.env.DB_PASSWORD,
  {
    host: process.env.DB_HOST,
    port: process.env.DB_PORT,
    dialect: 'postgres',
    logging: process.env.NODE_ENV === 'production' ? false : console.log,
    pool: {
      max: 10,
      min: 0,
      acquire: 30000,
      idle: 10000,
    },
  }
);

async function testConnection() {
  try {
    await sequelize.authenticate();
    console.log('✅ Database connection established successfully.');
  } catch (error) {
    console.error('❌ Unable to connect to the database:', error.message);
    throw error;
  }
}

async function withTransaction(callback) {
  const transaction = await sequelize.transaction();
  try {
    const result = await callback(transaction);
    await transaction.commit();
    return result;
  } catch (error) {
    await transaction.rollback();
    console.error('[withTransaction] raw error:', error);
    console.error('[withTransaction] error name:', error?.name);
    console.error('[withTransaction] error message:', error?.message);
    console.error('[withTransaction] error original:', error?.original);
    if (error.statusCode) {
      throw error;
    }
    throw {
      statusCode: 500,
      message: error.message || 'Transaction failed',
    };
  }
}

module.exports = {
  sequelize,
  Sequelize,
  testConnection,
  withTransaction,
};

module.exports.development = config;
module.exports.test = config;
module.exports.production = { ...config, logging: false };
module.exports.default = testConnection;