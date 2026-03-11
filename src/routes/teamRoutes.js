'use strict';

const express = require('express');
const router = express.Router();

const { authMiddleware } = require('../middlewares/authMiddleware');
const { myteam } = require('../controllers/teamController');

// GET /api/team
router.get('/', authMiddleware, myteam);

module.exports = router;