'use strict';

const asyncWrapper = require('../../core/utils/asyncWrapper');
const rolesService = require('./roles.service');

const getRoles = asyncWrapper(async (req, res) => {
	const result = await rolesService.getRoles(req.query);
	res.json({
		success: true,
		data: result.data,
		meta: result.meta,
	});
});

const getPermissions = asyncWrapper(async (req, res) => {
	const permissions = await rolesService.getPermissions();
	res.json({ success: true, data: permissions });
});

const getRole = asyncWrapper(async (req, res) => {
	const role = await rolesService.getRole(req.params.id);
	if (!role) return res.status(404).json({ success: false, message: 'Role not found' });
	res.json({ success: true, data: role });
});

const createRole = asyncWrapper(async (req, res) => {
	const result = await rolesService.createRole(req.body, req.user, req);
	res.status(result.status).json(result.body);
});

const updateRole = asyncWrapper(async (req, res) => {
	const result = await rolesService.updateRole(req.params.id, req.body, req.user, req);
	res.status(result.status).json(result.body);
});

const deleteRole = asyncWrapper(async (req, res) => {
	const result = await rolesService.deleteRole(req.params.id, req.user, req);
	res.status(result.status).json(result.body);
});

module.exports = {
	getRoles,
	getPermissions,
	getRole,
	createRole,
	updateRole,
	deleteRole,
};