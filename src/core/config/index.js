'use strict';

const database = require('./database');
const msal = require('./msalConfig');

module.exports = {
  ...database,
  ...msal,
};