'use strict';

const Joi = require('joi');

const roleSchema = Joi.object({
  name: Joi.string()
    .min(2)
    .max(50)
    .pattern(/^[a-zA-Z0-9_\s]+$/)
    .messages({
      'string.pattern.base': 'Role name can only contain letters, numbers, underscores and spaces',
    }),
  description: Joi.string().max(500).allow('', null),
  permission_ids: Joi.array().items(Joi.number().integer().min(1)).default([]),
  permissions: Joi.array().items(Joi.number().integer().min(1)).default([]),
});

const roleIdSchema = Joi.object({
  id: Joi.number().integer().positive().required(),
});

const createRoleSchema = roleSchema.fork(['name'], (schema) => schema.required());

const updateRoleSchema = roleSchema;

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

const deleteRoleSchema = Joi.object({
  reassign_to_id: Joi.number().integer().positive().required()
    .messages({
      'number.base': 'Reassign ID must be a number',
      'any.required': 'reassign_to_id is required when deleting a role',
    }),
});

const paginationSchema = Joi.object({
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(100).default(20),
  search: Joi.string().max(100).allow(''),
  role_id: Joi.number().integer().positive(),
});

const validate = (schema, property = 'body') => {
  return (req, res, next) => {
    const { error, value } = schema.validate(req[property], {
      abortEarly: false,
      stripUnknown: true,
      allowUnknown: false,
    });

    if (error) {
      const messages = error.details.map(d => d.message).join(', ');
      return res.status(400).json({
        success: false,
        message: messages,
        validationErrors: error.details.map(d => ({
          field: d.path.join('.'),
          message: d.message,
        })),
      });
    }


    req[property] = value;
    next();
  };
};

const validateQuery = (schema) => {
  return (req, res, next) => {
    const { error, value } = schema.validate(req.query, {
      abortEarly: false,
      stripUnknown: true,
    });

    if (error) {
      const messages = error.details.map(d => d.message).join(', ');
      return res.status(400).json({
        success: false,
        message: messages,
        validationErrors: error.details.map(d => ({
          field: d.path.join('.'),
          message: d.message,
        })),
      });
    }

    next();
  };
};

const validateParams = (schema) => {
  return (req, res, next) => {
    const { error, value } = schema.validate(req.params, {
      abortEarly: false,
      stripUnknown: true,
    });

    if (error) {
      const messages = error.details.map(d => d.message).join(', ');
      return res.status(400).json({
        success: false,
        message: messages,
        validationErrors: error.details.map(d => ({
          field: d.path.join('.'),
          message: d.message,
        })),
      });
    }

    next();
  };
};

const validateBody = (schema) => validate(schema, 'body');

const validateCreateRole = validateBody(createRoleSchema);
const validateUpdateRole = [
  validateParams(roleIdSchema),
  validateBody(updateRoleSchema),
];
const validateDeleteRole = [
  validateParams(roleIdSchema),
  validateBody(deleteRoleSchema),
];
const validateAssignRole = validateBody(assignRoleSchema);
const validateGetRoles = validateQuery(paginationSchema);
const validateGetUsers = validateQuery(paginationSchema);

module.exports = {
  validate,
  validateCreateRole,
  validateUpdateRole,
  validateDeleteRole,
  validateAssignRole,
  validateGetRoles,
  validateGetUsers,
  Joi,
};