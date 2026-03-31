  'use strict';

  const express = require('express');
  const router = express.Router();

  const { authMiddleware } = require('../../core/middlewares/authMiddleware');
  const { requirePermission, requireAnyPermission } = require('../roles/roles.permissions');
  const {
    getCourses,
    createCourse,
    updateCourse,
    archiveCourse,
    getCourseAssignments,
    getEmployeeAssignments,
    getMyAssignments,
    getMyAssignmentDetail,
    startMyAssignment,
    completeMyAssignment,
    bulkAssignCourse,
    cancelAssignment,
    getEligibleEmployees,
    getEligibleEmployeesIds,
  } = require('./courses.controller');
  const {
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
  } = require('./courses.validation');

  router.get('/', authMiddleware, requireAnyPermission('course_view', 'course_edit', 'course_assign'), validateGetCourses, getCourses);
  router.post('/', authMiddleware, requirePermission('course_edit'), validateCreateCourse, createCourse);
  router.patch('/:id', authMiddleware, requirePermission('course_edit'), validateUpdateCourse, updateCourse);
  router.delete('/:id', authMiddleware, requirePermission('course_edit'), validateArchiveCourse, archiveCourse);

  router.get('/my-assignments', authMiddleware, validateGetMyAssignments, getMyAssignments);
  router.get('/my-assignments/:assignmentId', authMiddleware, validateMyAssignmentId, getMyAssignmentDetail);
  router.patch('/my-assignments/:assignmentId/start', authMiddleware, validateStartMyAssignment, startMyAssignment);
  router.patch('/my-assignments/:assignmentId/complete', authMiddleware, validateCompleteMyAssignment, completeMyAssignment);

  router.get('/eligible-employees', authMiddleware, requirePermission('course_assign'), validateEligibleEmployees, getEligibleEmployees);
  router.get('/eligible-employees-ids', authMiddleware, requirePermission('course_assign'), validateEligibleEmployees, getEligibleEmployeesIds);
  router.get('/employee-assignments', authMiddleware, requireAnyPermission('course_view', 'course_edit', 'course_assign'), validateGetEmployeeAssignments, getEmployeeAssignments);
  router.get('/:id/assignments', authMiddleware, requireAnyPermission('course_view', 'course_edit', 'course_assign'), validateGetCourseAssignments, getCourseAssignments);
  router.post('/:id/assign', authMiddleware, requirePermission('course_assign'), validateBulkAssign, bulkAssignCourse);
  router.patch('/:courseId/assignments/:assignmentId/cancel', authMiddleware, requirePermission('course_assign'), validateCancelAssignment, cancelAssignment);

  module.exports = router;
