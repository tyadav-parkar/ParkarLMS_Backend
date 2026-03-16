'use strict';

const { Op } = require('sequelize');
const { Role, Permission, EmployeeRole, RolePermission, sequelize } = require('../../models');
const { logActivity, LOG_ACTIONS } = require('../audit/audit.service');
const { withTransaction } = require('../../core/config/database');

const MAX_LIMIT = 100;
const DEFAULT_LIMIT = 4;

async function getRoles(query) {
	const page = Math.max(1, parseInt(query.page, 10) || 1);
	const limit = Math.min(MAX_LIMIT, parseInt(query.limit, 10) || DEFAULT_LIMIT);
	const offset = (page - 1) * limit;

	const { count, rows } = await Role.findAndCountAll({
		include: [{
			model: Permission,
			as: 'permissions',
			through: { attributes: [] },
			attributes: ['id', 'key', 'label'],
		}],
		order: [['name', 'ASC']],
		limit,
		offset,
		distinct: true,
	});

	const roleIds = rows.map((r) => r.id);
	const countRows = await EmployeeRole.findAll({
		attributes: ['role_id', [sequelize.fn('COUNT', sequelize.col('employee_id')), 'count']],
		where: { role_id: roleIds },
		group: ['role_id'],
		raw: true,
	});
	const countMap = Object.fromEntries(countRows.map((r) => [r.role_id, parseInt(r.count, 10)]));
	const rolesWithCount = rows.map((role) => ({
		...role.toJSON(),
		employee_count: countMap[role.id] ?? 0,
	}));

	return {
		data: rolesWithCount,
		meta: {
			total: count,
			page,
			limit,
			pages: Math.ceil(count / limit),
		},
	};
}

async function getPermissions() {
	return Permission.findAll({ order: [['label', 'ASC']] });
}

async function getRole(id) {
	return Role.findByPk(id, {
		include: [{
			model: Permission,
			as: 'permissions',
			through: { attributes: [] },
			attributes: ['id', 'key', 'label', 'description'],
		}],
	});
}

async function createRole(body, actor, req) {
	const { name, description, permission_ids, permissions: permissionsBody } = body;
	const raw = (permission_ids && permission_ids.length > 0) ? permission_ids : (permissionsBody ?? []);
	const permissionIds = raw.map((p) => (typeof p === 'object' && p !== null ? p.id : p)).filter(Boolean);

	if (!name?.trim()) {
		return { status: 400, body: { success: false, message: 'Role name is required' } };
	}

	const result = await withTransaction(async (transaction) => {
		const existing = await Role.findOne({ where: { name: name.trim() }, transaction });
		if (existing) {
			throw { statusCode: 409, message: 'A role with this name already exists' };
		}

		const role = await Role.create({
			name: name.trim(),
			description: description?.trim() || null,
			is_system_role: false,
		}, { transaction });

		if (permissionIds.length > 0) {
			const validPerms = await Permission.findAll({
				where: { id: permissionIds },
				attributes: ['id'],
				transaction,
			});

			if (validPerms.length > 0) {
				await RolePermission.bulkCreate(
					validPerms.map((p) => ({ role_id: role.id, permission_id: p.id })),
					{ transaction, returning: false, ignoreDuplicates: true }
				);
			}
		}

		return Role.findByPk(role.id, {
			include: [{
				model: Permission,
				as: 'permissions',
				through: { attributes: [] },
				attributes: ['id', 'key', 'label'],
			}],
			transaction,
		});
	});

	logActivity({
		employeeId: actor.id,
		actionType: LOG_ACTIONS.ROLE_CREATED,
		actionDescription: `Role "${name.trim()}" created by ${actor.email}`,
		req,
	});

	return { status: 201, body: { success: true, data: result } };
}

async function updateRole(id, body, actor, req) {
	const result = await withTransaction(async (transaction) => {
		const role = await Role.findByPk(id, { transaction });
		if (!role) {
			throw { statusCode: 404, message: 'Role not found' };
		}

		if (!role.is_system_role) {
			if (body.name?.trim()) {
				const duplicate = await Role.findOne({
					where: { name: body.name.trim(), id: { [Op.ne]: role.id } },
					transaction,
				});
				if (duplicate) {
					throw { statusCode: 409, message: 'Role name already taken' };
				}

				await role.update({
					name: body.name.trim(),
					description: body.description?.trim() ?? role.description,
				}, { transaction });
			}
		} else if (body.name) {
			throw { statusCode: 403, message: 'Cannot rename system roles' };
		}

		const rawPerms = (body.permission_ids && body.permission_ids.length > 0) ? body.permission_ids : body.permissions;
		const incomingPerms = rawPerms !== undefined
			? rawPerms.map((p) => (typeof p === 'object' && p !== null ? p.id : p)).filter(Boolean)
			: undefined;

		if (incomingPerms !== undefined) {
			await RolePermission.destroy({ where: { role_id: role.id }, transaction });

			if (incomingPerms.length > 0) {
				const validPerms = await Permission.findAll({
					where: { id: incomingPerms },
					attributes: ['id'],
					transaction,
				});

				if (validPerms.length > 0) {
					await RolePermission.bulkCreate(
						validPerms.map((p) => ({ role_id: role.id, permission_id: p.id })),
						{ transaction, returning: false, ignoreDuplicates: true }
					);
				}
			}
		}

		return Role.findByPk(role.id, {
			include: [{
				model: Permission,
				as: 'permissions',
				through: { attributes: [] },
				attributes: ['id', 'key', 'label'],
			}],
			transaction,
		});
	});

	logActivity({
		employeeId: actor.id,
		actionType: LOG_ACTIONS.ROLE_UPDATED,
		actionDescription: `Role "${result.name}" updated by ${actor.email}`,
		req,
	});

	return { status: 200, body: { success: true, data: result } };
}

async function deleteRole(id, reassignToId, actor, req) {
	const result = await withTransaction(async (transaction) => {
		const role = await Role.findByPk(id, { transaction });
		if (!role) {
			throw { statusCode: 404, message: 'Role not found' };
		}

		if (role.is_system_role) {
			throw { statusCode: 403, message: 'System roles cannot be deleted' };
		}

		if (!reassignToId) {
			throw {
				statusCode: 400,
				message: 'reassign_to_id is required — pick a role to move affected employees to',
			};
		}

		const reassignTarget = await Role.findByPk(reassignToId, { transaction });
		if (!reassignTarget) {
			throw { statusCode: 400, message: 'Reassign target role not found' };
		}

		const affectedRows = await EmployeeRole.findAll({ where: { role_id: role.id }, transaction });
		for (const row of affectedRows) {
			const alreadyHasTarget = await EmployeeRole.findOne({
				where: { employee_id: row.employee_id, role_id: reassignTarget.id },
				transaction,
			});

			if (alreadyHasTarget) {
				await row.destroy({ transaction });
			} else {
				await row.update({ role_id: reassignTarget.id }, { transaction });
			}
		}

		const affectedCount = affectedRows.length;
		await role.destroy({ transaction });

		return {
			roleName: role.name,
			affectedCount,
			reassignTargetName: reassignTarget.name,
		};
	});

	logActivity({
		employeeId: actor.id,
		actionType: LOG_ACTIONS.ROLE_DELETED,
		actionDescription: `Role "${result.roleName}" deleted. ${result.affectedCount} employee(s) reassigned to "${result.reassignTargetName}"`,
		req,
	});

	return {
		status: 200,
		body: {
			success: true,
			message: `Role "${result.roleName}" deleted. ${result.affectedCount} employee(s) reassigned to "${result.reassignTargetName}".`,
		},
	};
}

module.exports = {
	getRoles,
	getPermissions,
	getRole,
	createRole,
	updateRole,
	deleteRole,
};