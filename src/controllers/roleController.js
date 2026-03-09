'use strict';

const { Op } = require('sequelize');
const { Role, Permission, Employee, Department, EmployeeRole, RolePermission, sequelize } = require('../models');
const asyncWrapper = require('../utils/asyncWrapper');
const { logActivity } = require('../services/activityLogger');
const { withTransaction } = require('../config/database');

const MAX_LIMIT     = 100;
const DEFAULT_LIMIT = 6;

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

  const rolesWithCount = await Promise.all(
    rows.map(async (role) => {
      const employeeCount = await EmployeeRole.count({ where: { role_id: role.id } });
      return { ...role.toJSON(), employee_count: employeeCount };
    })
  );

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

// ── GET /api/roles/users ───────────────────────────────────────────────────────
const getUsers = asyncWrapper(async (req, res) => {
  const page   = Math.max(1, parseInt(req.query.page)  || 1);
  const limit  = Math.min(MAX_LIMIT, Math.max(1, parseInt(req.query.limit) || DEFAULT_LIMIT));
  const offset = (page - 1) * limit;
  const { search = '', role_id } = req.query;

  const searchCondition = search
    ? {
        [Op.or]: [
          { first_name:      { [Op.iLike]: `%${search}%` } },
          { last_name:       { [Op.iLike]: `%${search}%` } },
          { email:           { [Op.iLike]: `%${search}%` } },
          { employee_number: { [Op.iLike]: `%${search}%` } },
        ],
      }
    : {};

  const { count, rows } = await Employee.scope('withInactive').findAndCountAll({
    where: searchCondition,
    distinct: true,
    col: 'id',
    include: [
      {
        model: Role,
        as: 'roles',
        through: { attributes: ['is_primary'] },
        attributes: ['id', 'name', 'is_system_role'],
        ...(role_id ? { where: { id: parseInt(role_id) }, required: true } : {}),
      },
      {
        model: Department,
        as: 'department',
        attributes: ['id', 'name'],
      },
    ],
    attributes: [
      'id', 'employee_number', 'first_name', 'last_name',
      'email', 'job_title', 'is_active', 'last_login',
    ],
    order: [['first_name', 'ASC'], ['last_name', 'ASC']],
    limit,
    offset,
  });

  res.json({
    success: true,
    data: rows,
    meta: {
      total: count,
      page,
      limit,
      pages: Math.ceil(count / limit),
    },
  });
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
    employeeId: req.user.id,
    actionType: 'ROLE_CREATED',
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
    employeeId: req.user.id,
    actionType: 'ROLE_DELETED',
    actionDescription: `Role "${result.roleName}" deleted. ${result.affectedCount} employee(s) reassigned to "${result.reassignTargetName}"`,
    req,
  });

  res.json({
    success: true,
    message: `Role "${result.roleName}" deleted. ${result.affectedCount} employee(s) reassigned to "${result.reassignTargetName}".`,
  });
});

// ── POST /api/roles/assign ─────────────────────────────────────────────────────
const SYSTEM_ROLE_NAMES = ['admin', 'manager', 'employee'];

const assignRole = asyncWrapper(async (req, res) => {
  const { employee_id, role_id } = req.body;

  if (!employee_id || !role_id) {
    return res.status(400).json({ success: false, message: 'employee_id and role_id are required' });
  }

  const result = await withTransaction(async (transaction) => {
    const employee = await Employee.scope('withInactive').findByPk(employee_id, {
      include: [{ model: Role, as: 'roles', through: { attributes: [] } }],
      transaction,
    });

    if (!employee) {
      throw { statusCode: 404, message: 'Employee not found' };
    }

    const role = await Role.findByPk(role_id, { transaction });
    if (!role) {
      throw { statusCode: 404, message: 'Role not found' };
    }

    const previousRoles = employee.roles?.map((r) => r.name) || [];
    const isIncomingSystemRole = SYSTEM_ROLE_NAMES.includes(role.name.toLowerCase());

    if (isIncomingSystemRole) {
      await employee.setRoles([role], { through: { is_primary: true }, transaction });
    } else {
      const currentSystemRoles = (employee.roles || []).filter(
        (r) => SYSTEM_ROLE_NAMES.includes(r.name.toLowerCase())
      );

      if (currentSystemRoles.length === 0) {
        await employee.setRoles([role], { through: { is_primary: true }, transaction });
      } else {
        const roleAssignments = [
          ...currentSystemRoles.map((sr, idx) => ({
            role:       sr,
            is_primary: idx === 0,
          })),
          { role, is_primary: false },
        ];

        await EmployeeRole.destroy({ where: { employee_id: employee.id }, transaction });

        await EmployeeRole.bulkCreate(
          roleAssignments.map(({ role: r, is_primary }) => ({
            employee_id: employee.id,
            role_id:     r.id,
            is_primary,
          })),
          { transaction }
        );
      }
    }

    return { employee, role, previousRoles, isIncomingSystemRole };
  });

  logActivity({
    employeeId: req.user.id,
    actionType: 'ROLE_ASSIGNED',
    actionDescription: `Role "${result.role.name}" assigned to ${result.employee.email} by ${req.user.email}`,
    targetType: 'employee',
    targetId: result.employee.id,
    metadata: {
      previous_roles:  result.previousRoles,
      new_role:        result.role.name,
      assignment_type: result.isIncomingSystemRole ? 'system_replace' : 'custom_additive',
    },
    req,
  });

  const responseMessage = result.isIncomingSystemRole
    ? `System role "${result.role.name}" assigned to ${result.employee.first_name} ${result.employee.last_name}. Previous roles replaced.`
    : `Custom role "${result.role.name}" added to ${result.employee.first_name} ${result.employee.last_name}. System role preserved.`;

  res.json({
    success: true,
    message: responseMessage,
    note: "Role change takes effect on the employee's next login.",
  });
});

module.exports = {
  getRoles,
  getPermissions,
  getUsers,
  getRole,
  createRole,
  updateRole,
  deleteRole,
  assignRole,
};