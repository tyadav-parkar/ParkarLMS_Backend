'use strict';

require('dotenv').config();

const { Sequelize } = require('sequelize');

// ── Sequelize CLI config export (used by sequelize-cli commands) ─────────────
// sequelize-cli reads this file and expects a plain config object
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

// ── Sequelize runtime instance ────────────────────────────────────────────────
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

// ── Connection test helper (called in server.js on startup) ──────────────────
async function testConnection() {
  try {
    await sequelize.authenticate();
    console.log('✅ Database connection established successfully.');
  } catch (error) {
    console.error('❌ Unable to connect to the database:', error.message);
    throw error;
  }
}

// ── Exports ───────────────────────────────────────────────────────────────────
// Named exports for runtime use
module.exports = { sequelize, Sequelize, testConnection };

// Sequelize CLI requires the config object to be accessible at module.exports
// (it reads development/test/production keys — we expose ours under 'development')
module.exports.development = config;
module.exports.test = config;
module.exports.production = { ...config, logging: false };

// Default export for convenience (testConnection)
module.exports.default = testConnection;
