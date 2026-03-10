'use strict';

const crypto     = require('crypto');
const jwt        = require('jsonwebtoken');
const { msalClient, SCOPES } = require('../config/msalConfig');
const { Employee, Role, Department, Permission, RefreshToken } = require('../models');
const { logActivity, LOG_ACTIONS } = require('../services/activityLogger');
const asyncWrapper = require('../utils/asyncWrapper');

const SYSTEM_ROLE_PRIORITY = ['admin', 'manager', 'employee'];

const IS_PROD           = process.env.NODE_ENV === 'production';
const ACCESS_EXPIRY     = process.env.JWT_EXPIRES_IN || '15m';
const REFRESH_EXPIRY_MS = 7 * 24 * 60 * 60 * 1000;

function buildRolePayload(roles = []) {
  const permSet   = new Set();
  const roleNames = [];
  let primaryRole = null;
  let systemRole  = null;

  for (const role of roles) {
    roleNames.push(role.name);
    const sysIndex = SYSTEM_ROLE_PRIORITY.indexOf(role.name.toLowerCase());
    if (sysIndex !== -1) {
      if (systemRole === null || sysIndex < SYSTEM_ROLE_PRIORITY.indexOf(systemRole.toLowerCase())) {
        systemRole = role.name;
      }
    }
    if (role.EmployeeRole?.is_primary) primaryRole = role.name;
    for (const perm of (role.permissions || [])) {
      permSet.add(perm.key);
    }
  }

  if (!roleNames.length) roleNames.push('employee');
  if (!primaryRole) primaryRole = systemRole || roleNames[0];

  return { primaryRole, roleNames, permissionKeys: [...permSet], systemRole };
}

function generateAccessToken(employee, rolePayload) {
  return jwt.sign(
    {
      id:          employee.id,
      email:       employee.email,
      role:        rolePayload.primaryRole,
      roles:       rolePayload.roleNames,
      permissions: rolePayload.permissionKeys,
      systemRole:  rolePayload.systemRole,
    },
    process.env.JWT_SECRET,
    { expiresIn: ACCESS_EXPIRY }
  );
}

async function createRefreshToken(employeeId, req) {
  const token     = crypto.randomBytes(64).toString('hex');
  const expiresAt = new Date(Date.now() + REFRESH_EXPIRY_MS);

  await RefreshToken.create({
    employee_id: employeeId,
    token,
    expires_at:  expiresAt,
    ip_address:  req.ip,
    user_agent:  req.headers['user-agent'] || null,
  });

  return token;
}

function setRefreshCookie(res, token) {
  res.cookie('lms_refresh', token, {
    httpOnly: true,
    secure:   IS_PROD,
    sameSite: IS_PROD ? 'strict' : 'lax',
    maxAge:   REFRESH_EXPIRY_MS,
    path:     '/api/auth',
  });
}

function clearRefreshCookie(res) {
  res.clearCookie('lms_refresh', { path: '/api/auth' });
}

const microsoftLogin = asyncWrapper(async (req, res) => {
  const authUrl = await msalClient.getAuthCodeUrl({
    scopes:      SCOPES,
    redirectUri: process.env.AZURE_REDIRECT_URI,
  });
  res.json({ authUrl });
});

const microsoftCallback = asyncWrapper(async (req, res) => {
  const { code } = req.query;

  if (!code) {
    return res.redirect(`${process.env.FRONTEND_URL}/unauthorized?error=no_code`);
  }

  const tokenResponse = await msalClient.acquireTokenByCode({
    code,
    scopes:      SCOPES,
    redirectUri: process.env.AZURE_REDIRECT_URI,
  });

  const emailFromAzure = tokenResponse.account.username.toLowerCase().trim();

  const employee = await Employee.scope('withInactive').findOne({
    where:   { email: emailFromAzure },
    include: [{
      model:   Role,
      as:      'roles',
      through: { attributes: ['is_primary'] },
      include: [{
        model:      Permission,
        as:         'permissions',
        through:    { attributes: [] },
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

  await employee.update({ last_login: new Date() });

  const rolePayload    = buildRolePayload(employee.roles || []);
  const accessToken    = generateAccessToken(employee, rolePayload);
  const refreshToken   = await createRefreshToken(employee.id, req);

  setRefreshCookie(res, refreshToken);

  logActivity({
    employeeId:        employee.id,
    actionType:        LOG_ACTIONS.LOGIN,
    actionDescription: `${employee.email} logged in via Azure AD`,
    req,
  });

  res.redirect(`${process.env.FRONTEND_URL}/auth/callback?token=${accessToken}`);
});

const refresh = asyncWrapper(async (req, res) => {
  const incomingToken = req.cookies?.lms_refresh;

  if (!incomingToken) {
    return res.status(401).json({ success: false, message: 'No refresh token' });
  }

  const stored = await RefreshToken.findOne({
    where: { token: incomingToken },
  });

  // Token not found — possible theft, do nothing
  if (!stored) {
    return res.status(401).json({ success: false, message: 'Invalid refresh token' });
  }

  // Token reuse detected — someone is using an already-used token
  // Wipe ALL refresh tokens for this employee immediately
  if (stored.is_revoked) {
    await RefreshToken.destroy({ where: { employee_id: stored.employee_id } });
    clearRefreshCookie(res);
    return res.status(401).json({ success: false, message: 'Refresh token reuse detected' });
  }

  if (new Date() > stored.expires_at) {
    await stored.destroy();
    clearRefreshCookie(res);
    return res.status(401).json({ success: false, message: 'Refresh token expired' });
  }

  const employee = await Employee.scope('withInactive').findOne({
    where:   { id: stored.employee_id },
    include: [{
      model:   Role,
      as:      'roles',
      through: { attributes: ['is_primary'] },
      include: [{
        model:      Permission,
        as:         'permissions',
        through:    { attributes: [] },
        attributes: ['key'],
      }],
    }],
  });

  if (!employee || !employee.is_active) {
    await stored.destroy();
    clearRefreshCookie(res);
    return res.status(401).json({ success: false, message: 'Account not found or deactivated' });
  }

  // Rotate — mark old token as revoked, issue a new one
  await stored.update({ is_revoked: true });
  const newRefreshToken = await createRefreshToken(employee.id, req);
  setRefreshCookie(res, newRefreshToken);

  const rolePayload = buildRolePayload(employee.roles || []);
  const accessToken = generateAccessToken(employee, rolePayload);

  res.json({ success: true, token: accessToken });
});

const getMe = asyncWrapper(async (req, res) => {
  const employee = await Employee.scope('withInactive').findOne({
    where:   { id: req.user.id },
    include: [
      {
        model:   Role,
        as:      'roles',
        through: { attributes: ['is_primary'] },
        include: [{
          model:      Permission,
          as:         'permissions',
          through:    { attributes: [] },
          attributes: ['key', 'label'],
        }],
      },
      { model: Department, as: 'department' },
      {
        model:      Employee.scope('withInactive'),
        as:         'manager',
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

  const { primaryRole, roleNames, permissionKeys, systemRole } = buildRolePayload(employee.roles || []);

  const userJson = {
    ...employee.toJSON(),
    role:   primaryRole,
    roles:  roleNames,
    systemRole,
  };

  res.json({ success: true, user: userJson, permissions: permissionKeys });
});

const logout = asyncWrapper(async (req, res) => {
  const incomingToken = req.cookies?.lms_refresh;

  if (incomingToken) {
    await RefreshToken.destroy({ where: { token: incomingToken } });
    clearRefreshCookie(res);
  }

  if (req.user) {
    logActivity({
      employeeId:        req.user.id,
      actionType:        LOG_ACTIONS.LOGOUT,
      actionDescription: `${req.user.email} logged out`,
      req,
    });
  }

  res.json({ success: true });
});

module.exports = { microsoftLogin, microsoftCallback, refresh, getMe, logout };