'use strict';

const asyncWrapper = require('../../core/utils/asyncWrapper');
const careerPathService = require('./career_path.service');

// GET /api/career-path?ideal_role_id=:id
const getCareerPath = asyncWrapper(async (req, res) => {
  const result = await careerPathService.getCareerPath(req.query.ideal_role_id);
  res.json({ success: true, data: result });
});

// GET /api/career-path/my-progress?ideal_role_id=:id
const getMyCareerProgress = asyncWrapper(async (req, res) => {
  const result = await careerPathService.getMyCareerProgress(
    req.query.ideal_role_id,
    req.user.id
  );
  res.json({ success: true, data: result });
});

// PATCH /api/career-path/employee/:employeeId/step
const promoteEmployeeStep = asyncWrapper(async (req, res) => {
  const result = await careerPathService.promoteEmployeeStep(
    Number(req.params.employeeId),
    req.body.career_path_id,
    req.user
  );
  res.json({ success: true, message: 'Career step updated successfully', data: result });
});

module.exports = { getCareerPath, getMyCareerProgress, promoteEmployeeStep };
