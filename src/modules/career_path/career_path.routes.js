'use strict';

const express = require('express');
const router = express.Router();

const { authMiddleware } = require('../../core/middlewares/authMiddleware');
const { requireManagerStrict, requireAdminStrict } = require('../roles/roles.permissions');
const {
  getCareerPath,
  getMyCareerProgress,
  promoteEmployeeStep,
} = require('./career_path.controller');
const {
  validateGetCareerPath,
  validatePromoteStepParams,
  validatePromoteStepBody,
} = require('./career_path.validation');

// GET /api/career-path?ideal_role_id=:id  — simple timeline (no employee context)
router.get('/', authMiddleware, validateGetCareerPath, getCareerPath);

// GET /api/career-path/my-progress?ideal_role_id=:id  — employee's full progress
router.get('/my-progress', authMiddleware, validateGetCareerPath, getMyCareerProgress);

// PATCH /api/career-path/employee/:employeeId/step  — manager/admin promotes employee
router.patch(
  '/employee/:employeeId/step',
  authMiddleware,
  validatePromoteStepParams,
  validatePromoteStepBody,
  promoteEmployeeStep
);

module.exports = router;
