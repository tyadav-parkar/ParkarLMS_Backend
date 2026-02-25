'use strict';

const jwt = require('jsonwebtoken');
const { msalClient, SCOPES } = require('../config/msalConfig');
const { Employee, Role, Department } = require('../models');
const { logActivity, LOG_ACTIONS } = require('../services/activityLogger');
const asyncWrapper = require('../utils/asyncWrapper');
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

  // Look up the employee by email (scope: withInactive so we can detect deactivated accounts)
  const employee = await Employee.scope('withInactive').findOne({
    where: { email: emailFromAzure },
  });

  if (!employee) {
    return res.redirect(`${process.env.FRONTEND_URL}/unauthorized?reason=not_registered`);
  }

  if (!employee.is_active) {
    return res.redirect(`${process.env.FRONTEND_URL}/unauthorized?reason=deactivated`);
  }

  // Fetch role permissions
  const roleRecord = await Role.findOne({ where: { name: employee.role } });

  // Update last_login
  await employee.update({ last_login: new Date() });

  // Issue LMS JWT
  const lmsToken = jwt.sign(
    { id: employee.id, email: employee.email, role: employee.role },
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
  // Use withInactive scope so findByPk is NOT blocked by the default is_active:true scope.
  // We manually check is_active below.
  const employee = await Employee.scope('withInactive').findOne({
    where: { id: req.user.id },
    include: [
      { model: Department, as: 'department' },
      {
        // Use unscoped Employee for the manager include — avoids the default scope
        // filtering out the manager JOIN and returning null for the whole row.
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

  const roleRecord = await Role.findOne({ where: { name: employee.role } });
  const permissions = roleRecord?.permissions || {};

  res.json({ user: employee, permissions });
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
