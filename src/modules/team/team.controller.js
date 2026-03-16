'use strict';

const asyncWrapper = require('../../core/utils/asyncWrapper');
const teamService = require('./team.service');

const myteam = asyncWrapper(async (req, res) => {
	const managerId = req.user.id;
	const { page, limit, search } = req.query;

	const result = await teamService.getTeamByManager(managerId, { page, limit, search });

	res.json({
		success: true,
		data: result.data,
		meta: result.meta,
	});
});

module.exports = { myteam };