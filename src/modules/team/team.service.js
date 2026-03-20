'use strict';

const { Op, fn, col } = require('sequelize');
const { Employee, Department } = require('../../models');

const DEFAULT_LIMIT = 5;
const MAX_LIMIT     = 100;

const getTeamByManager = async (managerId, { page = 1, limit = DEFAULT_LIMIT, search = '', jobTitle = '' } = {}) => {
  const safePage  = Math.max(1, parseInt(page,  10) || 1);
  const safeLimit = Math.min(MAX_LIMIT, parseInt(limit, 10) || DEFAULT_LIMIT);
  const offset    = (safePage - 1) * safeLimit;
  const trimmed   = search.trim();
  const trimmedJobTitle = jobTitle.trim();

  const whereClause = {
    manager_id: managerId,
    // Filter by exact job title if provided
    ...(trimmedJobTitle ? { job_title: trimmedJobTitle } : {}),
    // Search across name, email, job title
    ...(trimmed ? {
      [Op.or]: [
        { first_name: { [Op.iLike]: `%${trimmed}%` } },
        { last_name:  { [Op.iLike]: `%${trimmed}%` } },
        { email:      { [Op.iLike]: `%${trimmed}%` } },
        { job_title:  { [Op.iLike]: `%${trimmed}%` } },
      ],
    } : {}),
  };

  const total = await Employee.count({ where: whereClause });

  const data = await Employee.findAll({
    where:      whereClause,
    attributes: ['id', 'employee_number', 'first_name', 'last_name', 'email', 'job_title', 'band_identifier'],
    include: [{
      model:      Department,
      as:         'department',
      attributes: ['id', 'name'],
      required:   false,
    }],
    order:    [['first_name', 'ASC'], ['last_name', 'ASC']],
    limit:    safeLimit,
    offset,
    subQuery: false,
  });

  return {
    data,
    meta: { total, page: safePage, limit: safeLimit, pages: Math.ceil(total / safeLimit) },
  };
};

// Fetch all distinct job titles for the manager's team — not paginated
const getTeamJobTitles = async (managerId) => {
  const rows = await Employee.findAll({
    where: {
      manager_id: managerId,
      job_title:  { [Op.ne]: null },
    },
    attributes: [[fn('DISTINCT', col('job_title')), 'job_title']],
    order:      [[col('job_title'), 'ASC']],
    raw:        true,
  });

  return rows.map((r) => r.job_title).filter(Boolean);
};

module.exports = { getTeamByManager, getTeamJobTitles };