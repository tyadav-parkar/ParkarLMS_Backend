'use strict';

const asyncWrapper = require('../../core/utils/asyncWrapper');
const teamService  = require('./team.service');

const myteam = asyncWrapper(async (req, res) => {
  const managerId = req.user.id;
  const { page, limit, search, jobTitle } = req.query;

  const result = await teamService.getTeamByManager(managerId, { page, limit, search, jobTitle });

  res.json({
    success: true,
    data:    result.data,
    meta:    result.meta,
  });
});

const getJobTitles = asyncWrapper(async (req, res) => {
  const managerId = req.user.id;
  const titles    = await teamService.getTeamJobTitles(managerId);

  res.json({
    success: true,
    data:    titles,
  });
});

module.exports = { myteam, getJobTitles };