'use strict';
 
const crypto     = require('crypto');
const jwt        = require('jsonwebtoken');
const { msalClient, SCOPES } = require('../config/msalConfig');
const { Employee, Role, Department, Permission, RefreshToken } = require('../models');
const { logActivity, LOG_ACTIONS } = require('../services/activityLogger');
const asyncWrapper = require('../utils/asyncWrapper');
 
const SYSTEM_ROLE_PRIORITY = ['admin', 'manager', 'employee'];
 
const IS_PROD            = process.env.NODE_ENV === 'production';
const ACCESS_EXPIRY      = process.env.JWT_EXPIRES_IN || '15m';
const ACCESS_EXPIRY_MS   = 15 * 60 * 1000;          // must match ACCESS_EXPIRY
const REFRESH_EXPIRY_MS  = 7 * 24 * 60 * 60 * 1000;
 
// ── Role / permission helpers ─────────────────────────────────────────────────
 
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
 
// ── Token helpers ─────────────────────────────────────────────────────────────
 
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
 
// Access token — httpOnly, scoped to all /api routes, 15 min lifetime.
// JS cannot read this cookie — eliminates localStorage XSS exposure.
function setAccessCookie(res, token) {
  res.cookie('lms_access', token, {
    httpOnly: true,
    secure:   IS_PROD,
    sameSite: IS_PROD ? 'strict' : 'lax',
    maxAge:   ACCESS_EXPIRY_MS,
    path:     '/api',
  });
}
 
// Refresh token — httpOnly, scoped only to /api/auth, 7 day lifetime.
function setRefreshCookie(res, token) {
  res.cookie('lms_refresh', token, {
    httpOnly: true,
    secure:   IS_PROD,
    sameSite: IS_PROD ? 'strict' : 'lax',
    maxAge:   REFRESH_EXPIRY_MS,
    path:     '/api/auth',
  });
}
 
function clearAllCookies(res) {
  res.clearCookie('lms_access',   { path: '/api' });
  res.clearCookie('lms_refresh',  { path: '/api/auth' });
}

function verifyAccessCookie(req) {
  const token = req.cookies?.lms_access;
  if (!token) return null;

  try {
    return jwt.verify(token, process.env.JWT_SECRET);
  } catch {
    return null;
  }
}

async function getEmployeeWithRoles(employeeId) {
  return Employee.scope('withInactive').findOne({
    where: { id: employeeId },
    include: [
      {
        model: Role,
        as: 'roles',
        through: { attributes: ['is_primary'] },
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
}

function buildAuthResponse(employee) {
  const { primaryRole, roleNames, permissionKeys, systemRole } = buildRolePayload(employee.roles || []);

  const userJson = {
    ...employee.toJSON(),
    role: primaryRole,
    roles: roleNames,
    systemRole,
  };

  return { user: userJson, permissions: permissionKeys };
}
 
// ── Controllers ───────────────────────────────────────────────────────────────
 
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
 
  const rolePayload  = buildRolePayload(employee.roles || []);
  const accessToken  = generateAccessToken(employee, rolePayload);
  const refreshToken = await createRefreshToken(employee.id, req);
 
  // Both tokens go into httpOnly cookies — nothing in the URL, nothing in JS
  setAccessCookie(res, accessToken);
  setRefreshCookie(res, refreshToken);
 
  logActivity({
    employeeId:        employee.id,
    actionType:        LOG_ACTIONS.LOGIN,
    actionDescription: `${employee.email} logged in via Azure AD`,
    req,
  });
 
  res.redirect(`${process.env.FRONTEND_URL}/auth/callback`);
});
 
const refresh = asyncWrapper(async (req, res) => {
  const incomingToken = req.cookies?.lms_refresh;
 
  if (!incomingToken) {
    return res.status(401).json({ success: false, message: 'No refresh token' });
  }
 
  const stored = await RefreshToken.findOne({
    where: { token: incomingToken },
  });
 
  if (!stored) {
    return res.status(401).json({ success: false, message: 'Invalid refresh token' });
  }
 
  // Reuse detected — wipe all tokens for this employee immediately
  if (stored.is_revoked) {
    await RefreshToken.destroy({ where: { employee_id: stored.employee_id } });
    clearAllCookies(res);
    return res.status(401).json({ success: false, message: 'Refresh token reuse detected' });
  }
 
  if (new Date() > stored.expires_at) {
    await stored.destroy();
    clearAllCookies(res);
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
    clearAllCookies(res);
    return res.status(401).json({ success: false, message: 'Account not found or deactivated' });
  }
 
  // Rotate refresh token
  await stored.update({ is_revoked: true });
  const newRefreshToken = await createRefreshToken(employee.id, req);
 
  const rolePayload = buildRolePayload(employee.roles || []);
  const accessToken = generateAccessToken(employee, rolePayload);
 
  // Set both cookies — no token in response body
  setAccessCookie(res, accessToken);
  setRefreshCookie(res, newRefreshToken);
 
  res.json({ success: true });
});

const sessionStatus = asyncWrapper(async (req, res) => {
  const decoded = verifyAccessCookie(req);

  if (decoded?.id) {
    const employee = await getEmployeeWithRoles(decoded.id);
    if (employee && employee.is_active) {
      // Re-issue JWT with fresh permissions from DB.
      // Ensures that if an admin changed this user's role/permissions,
      // the new cookie carries updated claims on the very next page load.
      const rolePayload = buildRolePayload(employee.roles || []);
      const accessToken = generateAccessToken(employee, rolePayload);
      setAccessCookie(res, accessToken);
      const payload = buildAuthResponse(employee);
      return res.json({ success: true, authenticated: true, ...payload });
    }
    clearAllCookies(res);
    return res.json({ success: true, authenticated: false });
  }

  const incomingToken = req.cookies?.lms_refresh;
  if (!incomingToken) {
    return res.json({ success: true, authenticated: false });
  }

  const stored = await RefreshToken.findOne({ where: { token: incomingToken } });
  if (!stored) {
    clearAllCookies(res);
    return res.json({ success: true, authenticated: false });
  }

  if (stored.is_revoked) {
    await RefreshToken.destroy({ where: { employee_id: stored.employee_id } });
    clearAllCookies(res);
    return res.json({ success: true, authenticated: false });
  }

  if (new Date() > stored.expires_at) {
    await stored.destroy();
    clearAllCookies(res);
    return res.json({ success: true, authenticated: false });
  }

  const employee = await getEmployeeWithRoles(stored.employee_id);
  if (!employee || !employee.is_active) {
    await stored.destroy();
    clearAllCookies(res);
    return res.json({ success: true, authenticated: false });
  }

  await stored.update({ is_revoked: true });
  const newRefreshToken = await createRefreshToken(employee.id, req);
  const rolePayload = buildRolePayload(employee.roles || []);
  const accessToken = generateAccessToken(employee, rolePayload);

  setAccessCookie(res, accessToken);
  setRefreshCookie(res, newRefreshToken);

  const payload = buildAuthResponse(employee);
  return res.json({ success: true, authenticated: true, ...payload });
});
 
const getMe = asyncWrapper(async (req, res) => {
  const employee = await getEmployeeWithRoles(req.user.id);
 
  if (!employee) {
    return res.status(401).json({ success: false, message: 'Account not found' });
  }
 
  if (!employee.is_active) {
    return res.status(401).json({ success: false, message: 'Account deactivated' });
  }
 
  const payload = buildAuthResponse(employee);
  res.json({ success: true, ...payload });
});
 
const logout = asyncWrapper(async (req, res) => {
  const incomingToken = req.cookies?.lms_refresh;
 
  if (incomingToken) {
    await RefreshToken.destroy({ where: { token: incomingToken } });
  }
 
  clearAllCookies(res);
 
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
 
module.exports = { microsoftLogin, microsoftCallback, refresh, sessionStatus, getMe, logout };
 