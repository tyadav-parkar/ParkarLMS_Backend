'use strict';

const asyncWrapper = require('../../core/utils/asyncWrapper');
const coursesService = require('./courses.service');

const getCourses = asyncWrapper(async (req, res) => {
  const result = await coursesService.getCourses(req.query);
  res.json({ success: true, data: result.data, meta: result.meta });
});

const createCourse = asyncWrapper(async (req, res) => {
  const result = await coursesService.createCourse(req.body, req.user, req);
  res.status(201).json({ success: true, message: 'Course created successfully', data: result });
});

const updateCourse = asyncWrapper(async (req, res) => {
  const result = await coursesService.updateCourse(req.params.id, req.body);
  res.json({ success: true, message: 'Course updated successfully', data: result });
});

const archiveCourse = asyncWrapper(async (req, res) => {
  const result = await coursesService.archiveCourse(req.params.id, req.user, req);
  res.json({ success: true, message: result.message, data: result.data });
});

const getCourseAssignments = asyncWrapper(async (req, res) => {
  const result = await coursesService.getCourseAssignments(req.params.id, req.query, req.user);
  res.json({ success: true, data: result.data, meta: result.meta });
});

const getEmployeeAssignments = asyncWrapper(async (req, res) => {
  const result = await coursesService.getEmployeeAssignments(req.query, req.user);
  res.json({ success: true, data: result.data, meta: result.meta });
});

const getMyAssignments = asyncWrapper(async (req, res) => {
  const result = await coursesService.getMyAssignments(req.query, req.user);
  res.json({ success: true, data: result.data, meta: result.meta });
});

const getMyAssignmentDetail = asyncWrapper(async (req, res) => {
  const result = await coursesService.getMyAssignmentDetail(req.params.assignmentId, req.user);
  res.json({ success: true, data: result });
});

const startMyAssignment = asyncWrapper(async (req, res) => {
  const result = await coursesService.startMyAssignment(req.params.assignmentId, req.user, req);
  res.json({ success: true, message: 'Course started successfully', data: result });
});

const completeMyAssignment = asyncWrapper(async (req, res) => {
  const result = await coursesService.completeMyAssignment(req.params.assignmentId, req.user, req);
  res.json({ success: true, message: 'Course marked as complete', data: result });
});

const bulkAssignCourse = asyncWrapper(async (req, res) => {
  const result = await coursesService.bulkAssignCourse(req.params.id, req.body, req.user, req);
  res.status(201).json({ success: true, message: 'Course assigned successfully', data: result.data, meta: result.meta });
});

const cancelAssignment = asyncWrapper(async (req, res) => {
  const result = await coursesService.cancelAssignment(req.params.courseId, req.params.assignmentId, req.user);
  res.json({ success: true, message: 'Assignment cancelled successfully', data: result });
});

const getEligibleEmployeesIds = asyncWrapper(async (req, res) => {
  const result = await coursesService.getAllEligibleEmployeeIds(req.query, req.user);
  res.json({ success: true, data: result });
});

const getEligibleEmployees = asyncWrapper(async (req, res) => {
  const result = await coursesService.getEligibleEmployees(req.query, req.user);
  res.json({ success: true, data: result.data, meta: result.meta });
});

module.exports = {
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
};

