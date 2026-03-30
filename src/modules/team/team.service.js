'use strict';
 
const { Op, fn, col, QueryTypes } = require('sequelize');
const { Employee, Department, sequelize }  = require('../../models');
 
const DEFAULT_LIMIT = 10;
const MAX_LIMIT     = 100;
 
/* ── Direct reports — sorted A→Z by first_name, last_name ──────────── */
const getTeamByManager = async (
  managerId,
  { page = 1, limit = DEFAULT_LIMIT, search = '', jobTitle = '' } = {}
) => {
  const safePage  = Math.max(1, parseInt(page,  10) || 1);
  const safeLimit = Math.min(MAX_LIMIT, parseInt(limit, 10) || DEFAULT_LIMIT);
  const offset    = (safePage - 1) * safeLimit;
  const trimmed   = search.trim();
 
const whereClause = {
    manager_id: managerId,
    is_active: true,
    ...(jobTitle.trim() ? { job_title: jobTitle.trim() } : {}),
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
  const data  = await Employee.findAll({
    where:      whereClause,
    attributes: ['id', 'employee_number', 'first_name', 'last_name', 'email', 'job_title', 'band_identifier'],
    include: [{
      model:      Department,
      as:         'department',
      attributes: ['id', 'name'],
      required:   false,
    }],
    // A→Z by name
    order:    [['first_name', 'ASC'], ['last_name', 'ASC']],
    limit:    safeLimit,
    offset,
    subQuery: false,
  });
 
  return {
    data,
    meta: {
      total,
      page:  safePage,
      limit: safeLimit,
      pages: Math.ceil(total / safeLimit),
    },
  };
};
 
/* ── Indirect reports — sorted by manager name, then employee name ───── */
const getIndirectReports = async (
  managerId,
  { page = 1, limit = DEFAULT_LIMIT, search = '', jobTitle = '' } = {}
) => {
  const safePage  = Math.max(1, parseInt(page,  10) || 1);
  const safeLimit = Math.min(MAX_LIMIT, parseInt(limit, 10) || DEFAULT_LIMIT);
  const offset    = (safePage - 1) * safeLimit;
  const trimmed   = search.trim();
 
  const searchFilter = trimmed
    ? `AND (
        e.first_name ILIKE :search OR
        e.last_name  ILIKE :search OR
        e.email      ILIKE :search OR
        e.job_title  ILIKE :search
      )`
    : '';
 
  const jobTitleFilter = jobTitle.trim()
    ? `AND e.job_title = :jobTitle`
    : '';
 
  const replacements = {
    managerId,
    search:   trimmed ? `%${trimmed}%` : null,
    jobTitle: jobTitle.trim() || null,
    limit:    safeLimit,
    offset,
  };
 
  // Count
  const countRows = await sequelize.query(
    `
    WITH RECURSIVE tree AS (
      SELECT id, manager_id, 1 AS lvl
      FROM   employees
      WHERE  manager_id = :managerId
        AND employees.is_active = true
 
      UNION ALL
 
      SELECT e.id, e.manager_id, t.lvl + 1
      FROM   employees e
      INNER JOIN tree t ON e.manager_id = t.id
      WHERE e.is_active = true
    )
    SELECT COUNT(*) AS total
    FROM   tree
    INNER JOIN employees e ON e.id = tree.id
    WHERE  e.is_active = true
      AND tree.lvl > 1
      ${searchFilter}
      ${jobTitleFilter}
    `,
    { replacements, type: QueryTypes.SELECT }
  );
 
  const total = parseInt(countRows[0]?.total ?? 0, 10);
 
  // Data — ORDER BY manager first_name, manager last_name, then employee name
  const rows = await sequelize.query(
    `
    WITH RECURSIVE tree AS (
      SELECT id, manager_id, 1 AS lvl
      FROM   employees
      WHERE  manager_id = :managerId
        AND employees.is_active = true
 
      UNION ALL
 
      SELECT e.id, e.manager_id, t.lvl + 1
      FROM   employees e
      INNER JOIN tree t ON e.manager_id = t.id
      WHERE e.is_active = true
    )
    SELECT
      e.id,
      e.employee_number,
      e.first_name,
      e.last_name,
      e.email,
      e.job_title,
      e.band_identifier,
      tree.lvl          AS depth,
      d.id              AS "department.id",
      d.name            AS "department.name",
      m.id              AS "manager.id",
      m.first_name      AS "manager.first_name",
      m.last_name       AS "manager.last_name"
    FROM   tree
    INNER JOIN employees  e ON e.id      = tree.id
    LEFT  JOIN departments d ON d.id     = e.department_id
    LEFT  JOIN employees  m ON m.id      = e.manager_id
    WHERE  e.is_active = true
      AND tree.lvl > 1
      ${searchFilter}
      ${jobTitleFilter}
    ORDER  BY
      m.first_name ASC,
      m.last_name  ASC,
      e.first_name ASC,
      e.last_name  ASC
    LIMIT  :limit
    OFFSET :offset
    `,
    { replacements, type: QueryTypes.SELECT, nest: true }
  );
 
  return {
    data: rows,
    meta: {
      total,
      page:  safePage,
      limit: safeLimit,
      pages: Math.ceil(total / safeLimit),
    },
  };
};
 
/* ── Distinct job titles for direct reports ─────────────────────────── */
const getTeamJobTitles = async (managerId) => {
  const rows = await Employee.findAll({
    where: {
      manager_id: managerId,
      is_active: true,
      job_title:  { [Op.ne]: null },
    },
    attributes: [[fn('DISTINCT', col('job_title')), 'job_title']],
    order:      [[col('job_title'), 'ASC']],
    raw:        true,
  });
  return rows.map((r) => r.job_title).filter(Boolean);
};
 
/* ── Distinct job titles for indirect reports ───────────────────────── */
const getIndirectJobTitles = async (managerId) => {
  const rows = await sequelize.query(
    `
    WITH RECURSIVE tree AS (
      SELECT id, 1 AS lvl
    FROM   employees
      WHERE  manager_id = :managerId
        AND employees.is_active = true
 
      UNION ALL
 
      SELECT e.id, t.lvl + 1
      FROM   employees e
      INNER JOIN tree t ON e.manager_id = t.id
      WHERE e.is_active = true
    )
    SELECT DISTINCT e.job_title
    FROM   tree
    INNER JOIN employees e ON e.id = tree.id
    WHERE  tree.lvl > 1
      AND  e.job_title IS NOT NULL
    ORDER  BY e.job_title ASC
    `,
    { replacements: { managerId }, type: QueryTypes.SELECT }
  );
  return rows.map((r) => r.job_title).filter(Boolean);
};
 
module.exports = {
  getTeamByManager,
  getIndirectReports,
  getTeamJobTitles,
  getIndirectJobTitles,
};
 