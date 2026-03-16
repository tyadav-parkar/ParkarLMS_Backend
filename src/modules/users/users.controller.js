'use strict';

const asyncWrapper = require('../../core/utils/asyncWrapper');
const usersService = require('./users.service');

const getUsers = asyncWrapper(async (req, res) => {
 	const result = await usersService.getUsers(req.query);

	res.json({
		success: true,
		data: result.data,
		meta: result.meta,
	});
});

const assignRole = asyncWrapper(async (req, res) => {
	const result = await usersService.assignRole(req.body.employee_id, req.body.role_id, req.user, req);
	res.status(result.status).json(result.body);
});

module.exports = { getUsers, assignRole };