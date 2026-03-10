'use strict';

const { Op } = require('sequelize');
const { Employee, Role, Department, EmployeeRole } = require('../models');
const asyncWrapper = require('../utils/asyncWrapper');
const { logActivity, LOG_ACTIONS } = require('../services/activityLogger');
const { withTransaction } = require('../config/database');

const MAX_LIMIT     = 100;
const DEFAULT_LIMIT = 4;

const SYSTEM_ROLE_NAMES = ['admin', 'manager', 'employee'];

// ── GET /api/users ─────────────────────────────────────────────────────────────
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

// ── POST /api/users/assign ─────────────────────────────────────────────────────
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

    const previousRoles        = employee.roles?.map((r) => r.name) || [];
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
    employeeId:        req.user.id,
    actionType:        LOG_ACTIONS.ROLE_ASSIGNED,
    actionDescription: `Role "${result.role.name}" assigned to ${result.employee.email} by ${req.user.email}`,
    targetType:        'employee',
    targetId:          result.employee.id,
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

module.exports = { getUsers, assignRole };
