'use strict';

const { Employee, Role, Permission } = require('../../models');

// Fetch fresh roles + permissions from DB so JWT staleness does not affect authorization.
async function getEmployeeRolesAndPermissions(employeeId) {
	const employee = await Employee.findByPk(employeeId, {
		include: [{
			model: Role,
			as: 'roles',
			through: { attributes: ['is_primary'] },
			include: [{
				model: Permission,
				as: 'permissions',
				through: { attributes: [] },
				attributes: ['key'],
			}],
		}],
	});

	if (!employee || !employee.is_active) return null;

	const roles = employee.roles.map((r) => r.name.toLowerCase());
	const systemRole = employee.roles.find((r) => r.EmployeeRole?.is_primary)?.name?.toLowerCase() ?? null;
	const permissions = employee.roles.flatMap((r) => (r.permissions || []).map((p) => p.key));

	return { roles, systemRole, permissions };
}

// Backward-compatible helper used by permission middleware.
async function getEmployeePermissions(employeeId) {
	const result = await getEmployeeRolesAndPermissions(employeeId);
	return result?.permissions ?? null;
}

const requireRole = (...allowedRoles) => (req, res, next) => {
	const roles = (req.user.roles || [req.user.role]).map((r) => r?.toLowerCase());
	const systemRole = req.user.systemRole?.toLowerCase() || null;

	if (roles.includes('admin') || systemRole === 'admin') return next();

	const allowed = allowedRoles.map((r) => r.toLowerCase());
	if (allowed.some((r) => roles.includes(r))) return next();
	if (systemRole && allowed.includes(systemRole)) return next();

	return res.status(403).json({ success: false, message: 'Insufficient role' });
};

// Strict role check - always fetches fresh DB roles and does not auto-pass admin.
const requireStrictRole = (...allowedRoles) => async (req, res, next) => {
	if (!req.user) {
		return res.status(401).json({ success: false, message: 'Authentication required' });
	}

	try {
		const fresh = await getEmployeeRolesAndPermissions(req.user.id);

		if (fresh === null) {
			return res.status(401).json({
				success: false,
				message: 'Account not found or deactivated. Please login again.',
			});
		}

		const allowed = allowedRoles.map((r) => r.toLowerCase());

		if (allowed.some((r) => fresh.roles.includes(r))) return next();
		if (fresh.systemRole && allowed.includes(fresh.systemRole)) return next();

		return res.status(403).json({
			success: false,
			message: `Access denied. This area is restricted to: ${allowedRoles.join(', ')}.`,
		});
	} catch (err) {
		return next(err);
	}
};

// Convenience wrappers for common strict role gates.
const requireAdminStrict = requireStrictRole('admin');
const requireManagerStrict = requireStrictRole('manager');

const requirePermission = (permission) => async (req, res, next) => {
	if (!req.user) {
		return res.status(401).json({ success: false, message: 'Authentication required' });
	}

	const roles = (req.user.roles || [req.user.role]).map((r) => r?.toLowerCase());
	const systemRole = req.user.systemRole?.toLowerCase() || null;

	if (roles.includes('admin') || systemRole === 'admin') return next();

	try {
		const freshPerms = await getEmployeePermissions(req.user.id);
		if (freshPerms === null) {
			return res.status(401).json({ success: false, message: 'Account not found or deactivated' });
		}
		if (freshPerms.includes(permission)) return next();
	} catch (err) {
		return next(err);
	}

	return res.status(403).json({
		success: false,
		message: `Access denied. Required permission: ${permission}`,
		required: permission,
		yourRole: req.user.role,
	});
};

const requireAnyPermission = (...permissions) => async (req, res, next) => {
	if (!req.user) {
		return res.status(401).json({ success: false, message: 'Authentication required' });
	}

	const roles = (req.user.roles || [req.user.role]).map((r) => r?.toLowerCase());
	const systemRole = req.user.systemRole?.toLowerCase() || null;

	if (roles.includes('admin') || systemRole === 'admin') return next();

	try {
		const freshPerms = await getEmployeePermissions(req.user.id);
		if (freshPerms === null) {
			return res.status(401).json({ success: false, message: 'Account not found or deactivated' });
		}
		if (permissions.some((p) => freshPerms.includes(p))) return next();
	} catch (err) {
		return next(err);
	}

	return res.status(403).json({
		success: false,
		message: `Access denied. Required one of: ${permissions.join(', ')}`,
		required: permissions,
	});
};

module.exports = {
	requireRole,
	requireStrictRole,
	requireAdminStrict,
	requireManagerStrict,
	requirePermission,
	requireAnyPermission,
};