'use strict';

const Joi = require('joi');
const { validateQuery, validateParams, validateBody } = require('../../core/middlewares/validate');

const getCareerPathQuerySchema = Joi.object({
  ideal_role_id: Joi.number().integer().positive().required(),
});

const promoteStepParamsSchema = Joi.object({
  employeeId: Joi.number().integer().positive().required(),
});

const promoteStepBodySchema = Joi.object({
  career_path_id: Joi.number().integer().positive().required(),
});

const validateGetCareerPath    = validateQuery(getCareerPathQuerySchema);
const validatePromoteStepParams = validateParams(promoteStepParamsSchema);
const validatePromoteStepBody   = validateBody(promoteStepBodySchema);

module.exports = {
  validateGetCareerPath,
  validatePromoteStepParams,
  validatePromoteStepBody,
};
