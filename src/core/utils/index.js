'use strict';

const asyncWrapper = require('./asyncWrapper');
const logger = require('./logger');

module.exports = {
  asyncWrapper,
  ...asyncWrapper,
  logger,
};