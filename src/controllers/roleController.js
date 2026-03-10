'use strict';

const { Op } = require('sequelize');
const { Role, Permission, EmployeeRole, RolePermission, sequelize } = require('../models');
const asyncWrapper = require('../utils/asyncWrapper');
const { logActivity, LOG_ACTIONS } = require('../services/activityLogger');
const { withTransaction } = require('../config/database');

const MAX_LIMIT     = 100;
const DEFAULT_LIMIT = 4;

// ── GET /api/roles ─────────────────────────────────────────────────────────────
const getRoles = asyncWrapper(async (req, res) => {
  const page   = Math.max(1, parseInt(req.query.page,  10) || 1);
  const limit  = Math.min(MAX_LIMIT, parseInt(req.query.limit, 10) || DEFAULT_LIMIT);
  const offset = (page - 1) * limit;

  const { count, rows } = await Role.findAndCountAll({
    include: [{
      model: Permission,
      as: 'permissions',
      through: { attributes: [] },
      attributes: ['id', 'key', 'label'],
    }],
    order:    [['name', 'ASC']],
    limit,
    offset,
    distinct: true,
  });

  const roleIds  = rows.map((r) => r.id);
  const countRows = await EmployeeRole.findAll({
    attributes: ['role_id', [sequelize.fn('COUNT', sequelize.col('employee_id')), 'count']],
    where:  { role_id: roleIds },
    group:  ['role_id'],
    raw:    true,
  });
  const countMap = Object.fromEntries(
    countRows.map((r) => [r.role_id, parseInt(r.count, 10)])
  );
  const rolesWithCount = rows.map((role) => ({
    ...role.toJSON(),
    employee_count: countMap[role.id] ?? 0,
  }));

  res.json({
    success: true,
    data:    rolesWithCount,
    meta: {
      total: count,
      page,
      limit,
      pages: Math.ceil(count / limit),
    },
  });
});

// ── GET /api/roles/permissions ─────────────────────────────────────────────────
const getPermissions = asyncWrapper(async (req, res) => {
  const permissions = await Permission.findAll({
    order: [['label', 'ASC']],
  });
  res.json({ success: true, data: permissions });
});

// ── GET /api/roles/:id ─────────────────────────────────────────────────────────
const getRole = asyncWrapper(async (req, res) => {
  const role = await Role.findByPk(req.params.id, {
    include: [{
      model: Permission,
      as: 'permissions',
      through: { attributes: [] },
      attributes: ['id', 'key', 'label', 'description'],
    }],
  });
  if (!role) return res.status(404).json({ success: false, message: 'Role not found' });
  res.json({ success: true, data: role });
});

// ── POST /api/roles ────────────────────────────────────────────────────────────
const createRole = asyncWrapper(async (req, res) => {
  const { name, description, permission_ids, permissions: permissionsBody } = req.body;
  const raw = (permission_ids && permission_ids.length > 0) ? permission_ids : (permissionsBody ?? []);
  const permissionIds = raw.map((p) => (typeof p === 'object' && p !== null ? p.id : p)).filter(Boolean);


  if (!name?.trim()) {
    return res.status(400).json({ success: false, message: 'Role name is required' });
  }

  const result = await withTransaction(async (transaction) => {
    const existing = await Role.findOne({
      where: { name: name.trim() },
      transaction,
    });

    if (existing) {
      throw { statusCode: 409, message: 'A role with this name already exists' };
    }

    const role = await Role.create({
      name:           name.trim(),
      description:    description?.trim() || null,
      is_system_role: false,
    }, { transaction });

    // Use bulkCreate on the junction table directly so the transaction
    // is properly respected. Sequelize's setPermissions() on BelongsToMany
    // does not reliably propagate the transaction to the junction insert,
    // which causes the role_permissions rows to be silently skipped.
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

    const createdRole = await Role.findByPk(role.id, {
      include: [{
        model: Permission,
        as: 'permissions',
        through: { attributes: [] },
        attributes: ['id', 'key', 'label'],
      }],
      transaction,
    });

    return createdRole;
  });

  logActivity({
    employeeId:        req.user.id,
    actionType:        LOG_ACTIONS.ROLE_CREATED,
    actionDescription: `Role "${name.trim()}" created by ${req.user.email}`,
    req,
  });

  res.status(201).json({ success: true, data: result });
});

// ── PUT /api/roles/:id ─────────────────────────────────────────────────────────
const updateRole = asyncWrapper(async (req, res) => {
  const { id } = req.params;

  const result = await withTransaction(async (transaction) => {
    const role = await Role.findByPk(id, { transaction });

    if (!role) {
      throw { statusCode: 404, message: 'Role not found' };
    }

    if (!role.is_system_role) {
      if (req.body.name?.trim()) {
        const duplicate = await Role.findOne({
          where: { name: req.body.name.trim(), id: { [Op.ne]: role.id } },
          transaction,
        });

        if (duplicate) {
          throw { statusCode: 409, message: 'Role name already taken' };
        }

        await role.update({
          name:        req.body.name.trim(),
          description: req.body.description?.trim() ?? role.description,
        }, { transaction });
      }
    } else if (req.body.name) {
      throw { statusCode: 403, message: 'Cannot rename system roles' };
    }

    // Replace permission set using direct junction table operations
    // so the transaction is guaranteed to cover both the delete and insert.
    const rawPerms = (req.body.permission_ids && req.body.permission_ids.length > 0) ? req.body.permission_ids : req.body.permissions;
    const incomingPerms = rawPerms !== undefined
      ? rawPerms.map((p) => (typeof p === 'object' && p !== null ? p.id : p)).filter(Boolean)
      : undefined;
    if (incomingPerms !== undefined) {
      await RolePermission.destroy({
        where: { role_id: role.id },
        transaction,
      });

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

    const updatedRole = await Role.findByPk(role.id, {
      include: [{
        model: Permission,
        as: 'permissions',
        through: { attributes: [] },
        attributes: ['id', 'key', 'label'],
      }],
      transaction,
    });

    return updatedRole;
  });

  logActivity({
    employeeId:        req.user.id,
    actionType:        LOG_ACTIONS.ROLE_UPDATED,
    actionDescription: `Role "${result.name}" updated by ${req.user.email}`,
    req,
  });

  res.json({ success: true, data: result });
});

// ── DELETE /api/roles/:id ──────────────────────────────────────────────────────
const deleteRole = asyncWrapper(async (req, res) => {
  const { id } = req.params;
  const { reassign_to_id } = req.body;

  const result = await withTransaction(async (transaction) => {
    const role = await Role.findByPk(id, { transaction });

    if (!role) {
      throw { statusCode: 404, message: 'Role not found' };
    }

    if (role.is_system_role) {
      throw { statusCode: 403, message: 'System roles cannot be deleted' };
    }

    if (!reassign_to_id) {
      throw {
        statusCode: 400,
        message: 'reassign_to_id is required — pick a role to move affected employees to',
      };
    }

    const reassignTarget = await Role.findByPk(reassign_to_id, { transaction });

    if (!reassignTarget) {
      throw { statusCode: 400, message: 'Reassign target role not found' };
    }

    const affectedRows = await EmployeeRole.findAll({
      where: { role_id: role.id },
      transaction,
    });

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

    const affected = affectedRows.length;

    await role.destroy({ transaction });

    return { roleName: role.name, affectedCount: affected, reassignTargetName: reassignTarget.name };
  });

  logActivity({
    employeeId:        req.user.id,
    actionType:        LOG_ACTIONS.ROLE_DELETED,
    actionDescription: `Role "${result.roleName}" deleted. ${result.affectedCount} employee(s) reassigned to "${result.reassignTargetName}"`,
    req,
  });

  res.json({
    success: true,
    message: `Role "${result.roleName}" deleted. ${result.affectedCount} employee(s) reassigned to "${result.reassignTargetName}".`,
  });
});

module.exports = {
  getRoles,
  getPermissions,
  getRole,
  createRole,
  updateRole,
  deleteRole,
};