'use strict';

const { Employee, Role, Permission } = require('../../models');

async function getEmployeePermissions(employeeId) {
	const employee = await Employee.findByPk(employeeId, {
		include: [{
			model: Role,
			as: 'roles',
			through: { attributes: [] },
			include: [{
				model: Permission,
				as: 'permissions',
				through: { attributes: [] },
				attributes: ['key'],
			}],
		}],
	});

	if (!employee || !employee.is_active) return null;
	return employee.roles.flatMap(r => (r.permissions || []).map(p => p.key));
}

const requireRole = (...allowedRoles) => (req, res, next) => {
	const roles = (req.user.roles || [req.user.role]).map(r => r?.toLowerCase());
	const systemRole = req.user.systemRole?.toLowerCase() || null;

	if (roles.includes('admin') || systemRole === 'admin') return next();

	const allowed = allowedRoles.map(r => r.toLowerCase());
	if (allowed.some(r => roles.includes(r))) return next();
	if (systemRole && allowed.includes(systemRole)) return next();

	return res.status(403).json({ success: false, message: 'Insufficient role' });
};

const requirePermission = (permission) => async (req, res, next) => {
	if (!req.user) {
		return res.status(401).json({ success: false, message: 'Authentication required' });
	}

	const roles = (req.user.roles || [req.user.role]).map(r => r?.toLowerCase());
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

	const roles = (req.user.roles || [req.user.role]).map(r => r?.toLowerCase());
	const systemRole = req.user.systemRole?.toLowerCase() || null;

	if (roles.includes('admin') || systemRole === 'admin') return next();

	try {
		const freshPerms = await getEmployeePermissions(req.user.id);
		if (freshPerms === null) {
			return res.status(401).json({ success: false, message: 'Account not found or deactivated' });
		}
		if (permissions.some(p => freshPerms.includes(p))) return next();
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
	requirePermission,
	requireAnyPermission,
};