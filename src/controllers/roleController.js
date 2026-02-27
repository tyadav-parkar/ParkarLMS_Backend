'use strict';

const { Op } = require('sequelize');
const { Role, Permission, Employee, Department, EmployeeRole } = require('../models');
const asyncWrapper = require('../utils/asyncWrapper');
const { logActivity, LOG_ACTIONS } = require('../services/activityLogger');

// ── GET /api/roles ─────────────────────────────────────────────────────────────
// List all roles with their assigned permissions + employee count
const getRoles = asyncWrapper(async (req, res) => {
  const roles = await Role.findAll({
    include: [{
      model: Permission,
      as: 'permissions',
      through: { attributes: [] },
      attributes: ['id', 'key', 'label'],
    }],
    order: [['name', 'ASC']],
  });

  // Attach employee count per role — query junction table (no role_id on employees any more)
  const rolesWithCount = await Promise.all(
    roles.map(async (role) => {
      const count = await EmployeeRole.count({ where: { role_id: role.id } });
      return { ...role.toJSON(), employee_count: count };
    })
  );

  res.json({ success: true, data: rolesWithCount });
});

// ── GET /api/roles/permissions ─────────────────────────────────────────────────
// List all available permissions — used by admin UI checkbox list
// NOTE: this route MUST be registered before /:id in roleRoutes.js
const getPermissions = asyncWrapper(async (req, res) => {
  const permissions = await Permission.findAll({
    order: [['label', 'ASC']],
  });
  res.json({ success: true, data: permissions });
});

// ── GET /api/roles/users ───────────────────────────────────────────────────────
// User Management: list all employees with their current role (paginated + searchable)
const getUsers = asyncWrapper(async (req, res) => {
  const { page = 1, limit = 20, search = '', role_id } = req.query;
  const offset = (parseInt(page) - 1) * parseInt(limit);

  const whereClause = {};
  // Note: role_id is no longer a column on employees — filter is done via the M2M include

  const searchCondition = search
    ? {
        [Op.or]: [
          { first_name:       { [Op.iLike]: `%${search}%` } },
          { last_name:        { [Op.iLike]: `%${search}%` } },
          { email:            { [Op.iLike]: `%${search}%` } },
          { employee_number:  { [Op.iLike]: `%${search}%` } },
        ],
      }
    : {};

  const { count, rows } = await Employee.scope('withInactive').findAndCountAll({
    where: { ...whereClause, ...searchCondition },
    include: [
      {
        model: Role,
        as: 'roles',
        through: { attributes: ['is_primary'] }, // include is_primary for primary role detection
        attributes: ['id', 'name', 'is_system_role'],
        // If filtering by role_id, require the join and add a where on the Role model
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
    limit:  parseInt(limit),
    offset,
  });

  res.json({
    success: true,
    data: rows,
    meta: {
      total: count,
      page:  parseInt(page),
      limit: parseInt(limit),
      pages: Math.ceil(count / parseInt(limit)),
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
// Create a custom role with a chosen set of permissions
const createRole = asyncWrapper(async (req, res) => {
  const { name, description, permission_ids, permissions: permissionsBody } = req.body;
  const permission_ids_resolved = permission_ids ?? permissionsBody ?? [];

  if (!name?.trim()) {
    return res.status(400).json({ success: false, message: 'Role name is required' });
  }

  const existing = await Role.findOne({ where: { name: name.trim() } });
  if (existing) {
    return res.status(409).json({ success: false, message: 'A role with this name already exists' });
  }

  const role = await Role.create({
    name:           name.trim(),
    description:    description?.trim() || null,
    is_system_role: false,
  });

  if (permission_ids_resolved.length > 0) {
    const perms = await Permission.findAll({ where: { id: permission_ids_resolved } });
    await role.setPermissions(perms); // Sequelize M2M helper
  }

  const result = await Role.findByPk(role.id, {
    include: [{ model: Permission, as: 'permissions', through: { attributes: [] } }],
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
// Update role (system roles: only permissions can change, not name)
const updateRole = asyncWrapper(async (req, res) => {
  const role = await Role.findByPk(req.params.id);
  if (!role) return res.status(404).json({ success: false, message: 'Role not found' });

  if (!role.is_system_role) {
    // Custom role: allow name + description change
    if (req.body.name?.trim()) {
      const duplicate = await Role.findOne({
        where: { name: req.body.name.trim(), id: { [Op.ne]: role.id } },
      });
      if (duplicate) {
        return res.status(409).json({ success: false, message: 'Role name already taken' });
      }
      await role.update({
        name:        req.body.name.trim(),
        description: req.body.description?.trim() ?? role.description,
      });
    }
  } else if (req.body.name) {
    return res.status(403).json({ success: false, message: 'Cannot rename system roles' });
  }

  // Replace permission set for both system and custom roles
  // Accept either 'permission_ids' or 'permissions' key from request body
  const incomingPerms = req.body.permission_ids ?? req.body.permissions;
  if (incomingPerms !== undefined) {
    const perms = await Permission.findAll({ where: { id: incomingPerms } });
    await role.setPermissions(perms); // replaces all existing rows for this role in role_permissions
  }

  const result = await Role.findByPk(role.id, {
    include: [{ model: Permission, as: 'permissions', through: { attributes: [] } }],
  });

  res.json({ success: true, data: result });
});

// ── DELETE /api/roles/:id ──────────────────────────────────────────────────────
// Delete a custom role — must provide reassign_to_id for affected employees
const deleteRole = asyncWrapper(async (req, res) => {
  const { reassign_to_id } = req.body;

  const role = await Role.findByPk(req.params.id);
  if (!role) return res.status(404).json({ success: false, message: 'Role not found' });

  if (role.is_system_role) {
    return res.status(403).json({ success: false, message: 'System roles cannot be deleted' });
  }
  if (!reassign_to_id) {
    return res.status(400).json({
      success: false,
      message: 'reassign_to_id is required — pick a role to move affected employees to',
    });
  }

  const reassignTarget = await Role.findByPk(reassign_to_id);
  if (!reassignTarget) {
    return res.status(400).json({ success: false, message: 'Reassign target role not found' });
  }

  // Reassign all employees who had this role in the junction table
  const [affected] = await EmployeeRole.update(
    { role_id: reassignTarget.id },
    { where: { role_id: role.id } }  // update junction rows pointing to deleted role
  );

  await role.destroy(); // role_permissions rows cascade-delete via FK ON DELETE CASCADE

  logActivity({
    employeeId: req.user.id,
    actionType: 'ROLE_DELETED',
    actionDescription: `Role "${role.name}" deleted. ${affected} employee(s) reassigned to "${reassignTarget.name}"`,
    req,
  });

  res.json({
    success: true,
    message: `Role "${role.name}" deleted. ${affected} employee(s) reassigned to "${reassignTarget.name}".`,
  });
});

// ── POST /api/roles/assign ─────────────────────────────────────────────────────
// User Management: assign a role to an employee
const assignRole = asyncWrapper(async (req, res) => {
  const { employee_id, role_id } = req.body;

  if (!employee_id || !role_id) {
    return res.status(400).json({ success: false, message: 'employee_id and role_id are required' });
  }

  const employee = await Employee.scope('withInactive').findByPk(employee_id, {
    include: [{ model: Role, as: 'roles', through: { attributes: [] } }],
  });
  if (!employee) return res.status(404).json({ success: false, message: 'Employee not found' });

  const role = await Role.findByPk(role_id);
  if (!role) return res.status(404).json({ success: false, message: 'Role not found' });

  
  const previousRoles = employee.roles?.map((r) => r.name) || [];
  await employee.setRoles([role], { through: { is_primary: true } });

  logActivity({
    employeeId: req.user.id,
    actionType: 'ROLE_ASSIGNED',
    actionDescription: `Role "${role.name}" assigned to ${employee.email} by ${req.user.email}`,
    targetType: 'employee',
    targetId: employee.id,
    metadata: { previous_roles: previousRoles, new_role: role.name },
    req,
  });

  res.json({
    success: true,
    message: `Role "${role.name}" assigned to ${employee.first_name} ${employee.last_name}.`,
    note: 'Role change takes effect on the employee\'s next login.',
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
