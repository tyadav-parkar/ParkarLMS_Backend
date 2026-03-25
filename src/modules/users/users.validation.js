'use strict';

const Joi = require('joi');
const { validateBody, validateQuery } = require('../../core/middlewares/validate');

const assignRoleSchema = Joi.object({
	employee_id: Joi.number().integer().positive().required()
		.messages({
			'number.base': 'Employee ID must be a number',
			'any.required': 'Employee ID is required',
		}),
	role_id: Joi.number().integer().positive().required()
		.messages({
			'number.base': 'Role ID must be a number',
			'any.required': 'Role ID is required',
		}),
});

const userPaginationSchema = Joi.object({
	page: Joi.number().integer().min(1).default(1),
	limit: Joi.number().integer().min(1).max(100).default(10),
	search: Joi.string().max(100).allow('').default(''),
	role_id: Joi.number().integer().positive(),
});

const validateAssignRole = validateBody(assignRoleSchema);
const validateGetUsers = validateQuery(userPaginationSchema);

module.exports = {
	validateAssignRole,
	validateGetUsers,
	assignRoleSchema,
	userPaginationSchema,
};