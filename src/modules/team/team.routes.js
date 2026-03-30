'use strict';

const express = require('express');
const router  = express.Router();

const { authMiddleware } = require('../../core/middlewares/authMiddleware');
const { requireStrictRole } = require('../../modules/roles/roles.permissions');
const {
	myteam,
	indirectTeam,
	getJobTitles,
	getIndirectJobTitles,
} = require('./team.controller');

router.use(authMiddleware);
router.use(requireStrictRole('manager'));

router.get('/', myteam);
router.get('/indirect', indirectTeam);
router.get('/job-titles', getJobTitles);
router.get('/indirect/job-titles', getIndirectJobTitles);

module.exports = router;