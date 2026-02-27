'use strict';

const jwt = require('jsonwebtoken');
const { msalClient, SCOPES } = require('../config/msalConfig');
const { Employee, Role, Department, Permission } = require('../models');
const { logActivity, LOG_ACTIONS } = require('../services/activityLogger');
const asyncWrapper = require('../utils/asyncWrapper');

/**
 * buildRolePayload — derives JWT role fields from the M2M roles array.
 *
 * @param {Array} roles - array of Role instances (each with .permissions and .EmployeeRole junction)
 * @returns {{ primaryRole: string, roleNames: string[], permissionKeys: string[] }}
 *
 * primaryRole   = the role marked is_primary in employee_roles (for dashboard routing)
 * roleNames     = all role names the employee currently holds
 * permissionKeys = deduplicated UNION of all permissions across all roles
 */
function buildRolePayload(roles = []) {
  const permSet   = new Set();
  const roleNames = [];
  let   primaryRole = null;

  for (const role of roles) {
    roleNames.push(role.name);
    if (role.EmployeeRole?.is_primary) primaryRole = role.name;
    for (const perm of (role.permissions || [])) {
      permSet.add(perm.key);
    }
  }

  if (!roleNames.length) roleNames.push('employee');
  // Fall back: if no is_primary flag found, use first role in array
  if (!primaryRole) primaryRole = roleNames[0];

  return { primaryRole, roleNames, permissionKeys: [...permSet] };
}
// ── 1. microsoftLogin ─────────────────────────────────────────────────────────
// GET /api/auth/microsoft/login  (public)
const microsoftLogin = asyncWrapper(async (req, res) => {
  const authUrl = await msalClient.getAuthCodeUrl({
    scopes: SCOPES,
    redirectUri: process.env.AZURE_REDIRECT_URI,
  });

  res.json({ authUrl });
});

// ── 2. microsoftCallback ──────────────────────────────────────────────────────
// GET /api/auth/microsoft/callback  (public — Microsoft redirects here)
const microsoftCallback = asyncWrapper(async (req, res) => {
  const { code } = req.query;

  if (!code) {
    return res.redirect(`${process.env.FRONTEND_URL}/unauthorized?error=no_code`);
  }

  // Exchange auth code for tokens
  const tokenResponse = await msalClient.acquireTokenByCode({
    code,
    scopes: SCOPES,
    redirectUri: process.env.AZURE_REDIRECT_URI,
  });

  const emailFromAzure = tokenResponse.account.username.toLowerCase().trim();

  // JOIN Employee → Roles (M2M) → Permissions in a single query
  const employee = await Employee.scope('withInactive').findOne({
    where: { email: emailFromAzure },
    include: [{
      model: Role,
      as: 'roles',
      through: { attributes: ['is_primary'] }, // include is_primary for primary role detection
      include: [{
        model: Permission,
        as: 'permissions',
        through: { attributes: [] },
        attributes: ['key'],
      }],
    }],
  });

  if (!employee) {
    return res.redirect(`${process.env.FRONTEND_URL}/unauthorized?reason=not_registered`);
  }

  if (!employee.is_active) {
    return res.redirect(`${process.env.FRONTEND_URL}/unauthorized?reason=deactivated`);
  }

  // Update last_login
  await employee.update({ last_login: new Date() });

  // Build JWT payload from M2M roles array
  const { primaryRole, roleNames, permissionKeys } = buildRolePayload(employee.roles || []);

  // Issue LMS JWT — includes roles array + primary role + union of all permissions
  const lmsToken = jwt.sign(
    {
      id:          employee.id,
      email:       employee.email,
      role:        primaryRole,     // single primary role string (dashboard routing + backward compat)
      roles:       roleNames,       // full M2M roles array
      permissions: permissionKeys,  // union of all roles' permission keys
    },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || '8h' }
  );

  // Fire-and-forget activity log
  logActivity({
    employeeId: employee.id,
    actionType: LOG_ACTIONS.LOGIN,
    actionDescription: `${employee.email} logged in via Azure AD`,
    req,
  });

  res.redirect(`${process.env.FRONTEND_URL}/auth/callback?token=${lmsToken}`);
});

// ── 3. getMe ──────────────────────────────────────────────────────────────────
// GET /api/auth/me  (protected — requires authMiddleware)
const getMe = asyncWrapper(async (req, res) => {
  // JOIN Employee → Role → Permissions in one query (same pattern as microsoftCallback)
  const employee = await Employee.scope('withInactive').findOne({
    where: { id: req.user.id },
    include: [
      {
        model: Role,
        as: 'roles',
        through: { attributes: ['is_primary'] }, // include is_primary flag
        include: [{
          model: Permission,
          as: 'permissions',
          through: { attributes: [] },
          attributes: ['key', 'label'],
        }],
      },
      { model: Department, as: 'department' },
      {
        model: Employee.scope('withInactive'),
        as: 'manager',
        attributes: ['id', 'first_name', 'last_name', 'email'],
      },
    ],
  });

  if (!employee) {
    return res.status(401).json({ success: false, message: 'Account not found' });
  }

  if (!employee.is_active) {
    return res.status(401).json({ success: false, message: 'Account deactivated' });
  }

  // Build role/permission payload from M2M roles array (same helper as microsoftCallback)
  const { primaryRole, roleNames, permissionKeys } = buildRolePayload(employee.roles || []);

  
  const userJson = {
    ...employee.toJSON(),
    role:  primaryRole,  // single primary role string for dashboard routing
    roles: roleNames,    // full M2M roles array for permission/multi-role checks
  };

  res.json({ success: true, user: userJson, permissions: permissionKeys });
});

// ── 4. logout ─────────────────────────────────────────────────────────────────
// POST /api/auth/logout  (protected — requires authMiddleware)
const logout = asyncWrapper(async (req, res) => {
  logActivity({
    employeeId: req.user.id,
    actionType: LOG_ACTIONS.LOGOUT,
    actionDescription: `${req.user.email} logged out`,
    req,
  });

  res.json({ success: true });
});

module.exports = { microsoftLogin, microsoftCallback, getMe, logout };
