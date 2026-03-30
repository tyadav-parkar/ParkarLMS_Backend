'use strict';

const Joi = require('joi');
const { validateBody, validateQuery, validateParams } = require('../../core/middlewares/validate');

const courseIdParamsSchema = Joi.object({
  id: Joi.number().integer().positive().required(),
});

const courseAssignmentParamsSchema = Joi.object({
  courseId: Joi.number().integer().positive().required(),
  assignmentId: Joi.number().integer().positive().required(),
});

const myAssignmentParamsSchema = Joi.object({
  assignmentId: Joi.number().integer().positive().required(),
});

const getCoursesQuerySchema = Joi.object({
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(100).default(10),
  search: Joi.string().max(100).allow('').default(''),
  category: Joi.string().max(100).allow('').default(''),
  difficulty: Joi.string().valid('Beginner', 'Intermediate', 'Advanced').optional(),
  status: Joi.string().valid('active', 'archived').default('active'),
});

const createCourseSchema = Joi.object({
  title: Joi.string().trim().min(2).max(255).required(),
  provider: Joi.string().trim().max(100).allow('', null),
  externalUrl: Joi.string().uri().max(2048).allow('', null),
  category: Joi.string().trim().max(100).allow('', null),
  difficulty: Joi.string().valid('Beginner', 'Intermediate', 'Advanced').default('Beginner'),
  estimatedDurationMonths: Joi.number().min(0).max(999.9).precision(1).allow(null),
  description: Joi.string().max(10000).allow('', null),
  prerequisites: Joi.string().max(10000).allow('', null),
});

const updateCourseSchema = Joi.object({
  title: Joi.string().trim().min(2).max(255),
  provider: Joi.string().trim().max(100).allow('', null),
  externalUrl: Joi.string().uri().max(2048).allow('', null),
  category: Joi.string().trim().max(100).allow('', null),
  difficulty: Joi.string().valid('Beginner', 'Intermediate', 'Advanced'),
  estimatedDurationMonths: Joi.number().min(0).max(999.9).precision(1).allow(null),
  description: Joi.string().max(10000).allow('', null),
  prerequisites: Joi.string().max(10000).allow('', null),
}).min(1);

const getAssignmentsQuerySchema = Joi.object({
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(100).default(10),
  status: Joi.string().valid('assigned', 'in_progress', 'completed', 'cancelled').optional(),
});

const getEmployeeAssignmentsQuerySchema = Joi.object({
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(100).default(10),
  status: Joi.string().valid('assigned', 'in_progress', 'completed', 'cancelled').optional(),
  employeeId: Joi.number().integer().positive().optional(),
  search: Joi.string().max(100).allow('').default(''),
});

const getMyAssignmentsQuerySchema = Joi.object({
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(100).default(10),
  status: Joi.string().valid('assigned', 'in_progress', 'completed', 'cancelled').optional(),
  search: Joi.string().max(100).allow('').default(''),
});

const bulkAssignSchema = Joi.object({
  employeeIds: Joi.array().items(Joi.number().integer().positive()).min(1).required(),
  dueDate: Joi.date().iso().allow(null),
  notes: Joi.string().max(1000).allow('', null),
});

const eligibleEmployeesQuerySchema = Joi.object({
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(100).default(10),
  search: Joi.string().max(100).allow('').default(''),
  role: Joi.string().max(100).allow('').default(''),
  role_id: Joi.number().integer().positive(),
  department: Joi.string().max(100).allow('').default(''),
  department_id: Joi.number().integer().positive(),
  jobTitle: Joi.string().max(150).allow('').default(''),
});

const validateGetCourses = validateQuery(getCoursesQuerySchema);
const validateCreateCourse = validateBody(createCourseSchema);
const validateUpdateCourse = [validateParams(courseIdParamsSchema), validateBody(updateCourseSchema)];
const validateArchiveCourse = [validateParams(courseIdParamsSchema)];
const validateGetCourseAssignments = [validateParams(courseIdParamsSchema), validateQuery(getAssignmentsQuerySchema)];
const validateGetEmployeeAssignments = validateQuery(getEmployeeAssignmentsQuerySchema);
const validateGetMyAssignments = validateQuery(getMyAssignmentsQuerySchema);
const validateMyAssignmentId = [validateParams(myAssignmentParamsSchema)];
const validateStartMyAssignment = [validateParams(myAssignmentParamsSchema)];
const validateCompleteMyAssignment = [validateParams(myAssignmentParamsSchema)];
const validateBulkAssign = [validateParams(courseIdParamsSchema), validateBody(bulkAssignSchema)];
const validateCancelAssignment = [validateParams(courseAssignmentParamsSchema)];
const validateEligibleEmployees = validateQuery(eligibleEmployeesQuerySchema);

module.exports = {
  validateGetCourses,
  validateCreateCourse,
  validateUpdateCourse,
  validateArchiveCourse,
  validateGetCourseAssignments,
  validateGetEmployeeAssignments,
  validateGetMyAssignments,
  validateMyAssignmentId,
  validateStartMyAssignment,
  validateCompleteMyAssignment,
  validateBulkAssign,
  validateCancelAssignment,
  validateEligibleEmployees,
};
