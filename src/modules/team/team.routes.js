'use strict';

const express = require('express');
const router = express.Router();

const { authMiddleware } = require('../../core/middlewares/authMiddleware');
const { myteam } = require('./team.controller');

router.get('/', authMiddleware, myteam);

module.exports = router;