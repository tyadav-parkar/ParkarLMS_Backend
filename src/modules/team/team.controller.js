'use strict';

const asyncWrapper = require('../../core/utils/asyncWrapper');
const teamService  = require('./team.service');
const { Employee } = require('../../models');

const assertIsManager = async (employeeId, res) => {
  const directCount = await Employee.count({
    where: { manager_id: employeeId },
  });
  if (directCount === 0) {
    res.status(403).json({
      success: false,
      message: 'Access denied. No direct reports found for this account.',
    });
    return false;
  }
  return true;
};

const myteam = asyncWrapper(async (req, res) => {
  const managerId = req.user.id;
  const ok = await assertIsManager(managerId, res);
  if (!ok) return;

  const { page, limit, search, jobTitle } = req.query;

  const result = await teamService.getTeamByManager(managerId, { page, limit, search, jobTitle });

  res.json({
    success: true,
    data:    result.data,
    meta:    result.meta,
  });
});

const indirectTeam = asyncWrapper(async (req, res) => {
  const managerId = req.user.id;

  const ok = await assertIsManager(managerId, res);
  if (!ok) return;

  const { page, limit, search, jobTitle } = req.query;
  const result = await teamService.getIndirectReports(managerId, { page, limit, search, jobTitle });

  res.json({ success: true, data: result.data, meta: result.meta });
});

const getJobTitles = asyncWrapper(async (req, res) => {
  const managerId = req.user.id;
  const titles    = await teamService.getTeamJobTitles(managerId);

  res.json({
    success: true,
    data:    titles,
  });
});

const getIndirectJobTitles = asyncWrapper(async (req, res) => {
  const managerId = req.user.id;
  const titles = await teamService.getIndirectJobTitles(managerId);
  res.json({ success: true, data: titles });
});

module.exports = { myteam, indirectTeam, getJobTitles, getIndirectJobTitles };