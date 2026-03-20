'use strict';
 
const crypto = require('crypto');
const { Op } = require('sequelize');
const jwt = require('jsonwebtoken');
const { msalClient, SCOPES } = require('../../core/config/msalConfig');
const { Employee, Role, Department, Permission, RefreshToken } = require('../../models');
const { logActivity, LOG_ACTIONS } = require('../audit/audit.service');
 
const SYSTEM_ROLE_PRIORITY = ['admin', 'manager', 'employee'];
 
const ACCESS_EXPIRY     = process.env.JWT_EXPIRES_IN || '15m';
const ACCESS_EXPIRY_MS  = 15 * 60 * 1000;
const REFRESH_EXPIRY_MS = process.env.REFRESH_TOKEN_EXPIRES_IN ? parseInt(process.env.REFRESH_TOKEN_EXPIRES_IN) * 24 * 60 * 60 * 1000 : 7 * 24 * 60 * 60 * 1000;
 
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
 
function verifyAccessToken(token) {
    if (!token) return null;
    try {
        return jwt.verify(token, process.env.JWT_SECRET);
    } catch {
        return null;
    }
}
 
async function hasActiveSession(employeeId, refreshTokenCookie) {
    if (refreshTokenCookie) {
        const stored = await RefreshToken.findOne({
            where: {
                token: refreshTokenCookie,
                employee_id: employeeId,
                is_revoked: false,
            },
        });
 
        if (!stored) return false;
        if (new Date() > stored.expires_at) {
            await stored.destroy();
            return false;
        }
 
        return true;
    }
 
    const activeSession = await RefreshToken.findOne({
        where: {
            employee_id: employeeId,
            is_revoked: false,
            expires_at: { [Op.gt]: new Date() },
        },
        attributes: ['id'],
    });
 
    return Boolean(activeSession);
}
 
async function getEmployeeWithRoles(employeeId) {
    return Employee.scope('withInactive').findOne({
        where: { id: employeeId },
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
            {
                model:    Department,
                as:       'department',
                required: false, // ← LEFT JOIN — null department_id must not block auth
            },
            {
                model:      Employee,
                as:         'manager',
                attributes: ['id', 'first_name', 'last_name', 'email'],
                required:   false, // ← LEFT JOIN — null manager_id must not block auth
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
 
async function getMicrosoftLoginUrl() {
    return msalClient.getAuthCodeUrl({
        scopes:      SCOPES,
        redirectUri: process.env.AZURE_REDIRECT_URI,
    });
}
 
async function handleMicrosoftCallback(code, req) {
    if (!code) {
        return { redirectTo: `${process.env.FRONTEND_URL}/unauthorized?error=no_code` };
    }
 
    const tokenResponse = await msalClient.acquireTokenByCode({
        code,
        scopes:      SCOPES,
        redirectUri: process.env.AZURE_REDIRECT_URI,
    });
 
    const emailFromAzure = tokenResponse.account.username.toLowerCase().trim();
 
    const employee = await Employee.scope('withInactive').findOne({
        where: { email: emailFromAzure },
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
        return { redirectTo: `${process.env.FRONTEND_URL}/unauthorized?reason=not_registered` };
    }
 
    if (!employee.is_active) {
        return { redirectTo: `${process.env.FRONTEND_URL}/unauthorized?reason=deactivated` };
    }
 
    await employee.update({ last_login: new Date() });
 
    const rolePayload  = buildRolePayload(employee.roles || []);
    const accessToken  = generateAccessToken(employee, rolePayload);
    const refreshToken = await createRefreshToken(employee.id, req);
 
    logActivity({
        employeeId:        employee.id,
        actionType:        LOG_ACTIONS.LOGIN,
        actionDescription: `${employee.email} logged in via Azure AD`,
        req,
    });
 
    return {
        redirectTo: `${process.env.FRONTEND_URL}/auth/callback`,
        accessToken,
        refreshToken,
    };
}
 
async function refreshAuthSession(incomingToken, req) {
    if (!incomingToken) {
        return { status: 401, body: { success: false, message: 'No refresh token' } };
    }
 
    const stored = await RefreshToken.findOne({ where: { token: incomingToken } });
    if (!stored) {
        return { status: 401, body: { success: false, message: 'Invalid refresh token' } };
    }
 
    if (stored.is_revoked) {
        await RefreshToken.destroy({ where: { employee_id: stored.employee_id } });
        return { status: 401, clearCookies: true, body: { success: false, message: 'Refresh token reuse detected' } };
    }
 
    if (new Date() > stored.expires_at) {
        await stored.destroy();
        return { status: 401, clearCookies: true, body: { success: false, message: 'Refresh token expired' } };
    }
 
    const employee = await Employee.scope('withInactive').findOne({
        where: { id: stored.employee_id },
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
        return { status: 401, clearCookies: true, body: { success: false, message: 'Account not found or deactivated' } };
    }
 
    await stored.update({ is_revoked: true });
    const newRefreshToken = await createRefreshToken(employee.id, req);
    const rolePayload     = buildRolePayload(employee.roles || []);
    const accessToken     = generateAccessToken(employee, rolePayload);
 
    return { status: 200, accessToken, refreshToken: newRefreshToken, body: { success: true } };
}
 
async function getSessionStatus(accessTokenCookie, refreshTokenCookie, req) {
    const decoded = verifyAccessToken(accessTokenCookie);
 
    if (decoded?.id) {
        const sessionActive = await hasActiveSession(decoded.id, refreshTokenCookie);
        if (!sessionActive) {
            return { status: 200, clearCookies: true, body: { success: true, authenticated: false } };
        }
 
        const employee = await getEmployeeWithRoles(decoded.id);
        if (employee && employee.is_active) {
            const rolePayload = buildRolePayload(employee.roles || []);
            const accessToken = generateAccessToken(employee, rolePayload);
            const payload     = buildAuthResponse(employee);
            return { status: 200, accessToken, body: { success: true, authenticated: true, ...payload } };
        }
        return { status: 200, clearCookies: true, body: { success: true, authenticated: false } };
    }
 
    if (!refreshTokenCookie) {
        return { status: 200, body: { success: true, authenticated: false } };
    }
 
    const stored = await RefreshToken.findOne({ where: { token: refreshTokenCookie } });
    if (!stored) {
        return { status: 200, clearCookies: true, body: { success: true, authenticated: false } };
    }
 
    if (stored.is_revoked) {
        await RefreshToken.destroy({ where: { employee_id: stored.employee_id } });
        return { status: 200, clearCookies: true, body: { success: true, authenticated: false } };
    }
 
    if (new Date() > stored.expires_at) {
        await stored.destroy();
        return { status: 200, clearCookies: true, body: { success: true, authenticated: false } };
    }
 
    const employee = await getEmployeeWithRoles(stored.employee_id);
    if (!employee || !employee.is_active) {
        await stored.destroy();
        return { status: 200, clearCookies: true, body: { success: true, authenticated: false } };
    }
 
    await stored.update({ is_revoked: true });
    const newRefreshToken = await createRefreshToken(employee.id, req);
    const rolePayload     = buildRolePayload(employee.roles || []);
    const accessToken     = generateAccessToken(employee, rolePayload);
    const payload         = buildAuthResponse(employee);
 
    return { status: 200, accessToken, refreshToken: newRefreshToken, body: { success: true, authenticated: true, ...payload } };
}
 
async function getMe(userId) {
    const employee = await getEmployeeWithRoles(userId);
 
    if (!employee) {
        return { status: 401, body: { success: false, message: 'Account not found' } };
    }
    if (!employee.is_active) {
        return { status: 401, body: { success: false, message: 'Account deactivated' } };
    }
 
    const payload = buildAuthResponse(employee);
    return { status: 200, body: { success: true, ...payload } };
}
 
async function logout(incomingToken, user, req) {
    let destroyedCount = 0;
    if (user) {
        destroyedCount = await RefreshToken.destroy({ where: { employee_id: user.id } });
        logActivity({
            employeeId:        user.id,
            actionType:        LOG_ACTIONS.LOGOUT,
            actionDescription: `${user.email} logged out (destroyed ${destroyedCount} refresh tokens)`,
            req,
        });
    }
    return { status: 200, clearCookies: true, body: { success: true, message: `Logged out. Cleared ${destroyedCount} refresh tokens.` } };
}
 
module.exports = {
    ACCESS_EXPIRY_MS,
    REFRESH_EXPIRY_MS,
    getMicrosoftLoginUrl,
    handleMicrosoftCallback,
    refreshAuthSession,
    getSessionStatus,
    getMe,
    logout,
};
 