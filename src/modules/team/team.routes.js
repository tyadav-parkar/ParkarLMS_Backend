'use strict';

const express = require('express');
const router  = express.Router();

const { authMiddleware }        = require('../../core/middlewares/authMiddleware');
const { myteam, getJobTitles }  = require('./team.controller');

router.get('/',           authMiddleware, myteam);
router.get('/job-titles', authMiddleware, getJobTitles);

module.exports = router;