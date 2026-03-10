'use strict';

const Joi = require('joi');
const { validateBody, validateQuery, validateParams } = require('../middlewares/validate');

// ── Schemas ────────────────────────────────────────────────────────────────────

const roleIdSchema = Joi.object({
  id: Joi.number().integer().positive().required(),
});

const roleBodySchema = Joi.object({
  name: Joi.string()
    .min(2)
    .max(50)
    .pattern(/^[a-zA-Z0-9_\s]+$/)
    .messages({
      'string.pattern.base': 'Role name can only contain letters, numbers, underscores and spaces',
    }),
  description:    Joi.string().max(500).allow('', null),
  permission_ids: Joi.array().items(Joi.number().integer().min(1)).default([]),
  permissions:    Joi.array().items(Joi.number().integer().min(1)).default([]),
});

const createRoleSchema    = roleBodySchema.fork(['name'], (s) => s.required());
const updateRoleSchema    = roleBodySchema;

const deleteRoleBodySchema = Joi.object({
  reassign_to_id: Joi.number().integer().positive().required()
    .messages({
      'number.base': 'Reassign ID must be a number',
      'any.required': 'reassign_to_id is required when deleting a role',
    }),
});

const rolePaginationSchema = Joi.object({
  page:  Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(100).default(10),
});

// ── Named validators ───────────────────────────────────────────────────────────

const validateCreateRole = validateBody(createRoleSchema);

const validateUpdateRole = [
  validateParams(roleIdSchema),
  validateBody(updateRoleSchema),
];

const validateDeleteRole = [
  validateParams(roleIdSchema),
  validateBody(deleteRoleBodySchema),
];

const validateGetRoles = validateQuery(rolePaginationSchema);

module.exports = {
  validateCreateRole,
  validateUpdateRole,
  validateDeleteRole,
  validateGetRoles,
  roleIdSchema,
  roleBodySchema,
  createRoleSchema,
  updateRoleSchema,
  deleteRoleBodySchema,
  rolePaginationSchema,
};
