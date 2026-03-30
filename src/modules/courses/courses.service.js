'use strict';

const { Op, literal, QueryTypes } = require('sequelize');
const {
  Course,
  CourseAssignment,
  Employee,
  Department,
  Role,
  sequelize,
} = require('../../models');
const { withTransaction } = require('../../core/config/database');
const { logActivity, LOG_ACTIONS } = require('../audit/audit.service');
const { AppError, NotFoundError, ConflictError } = require('../../core/errors/AppError');

const DEFAULT_LIMIT = 10;
const MAX_LIMIT = 100;

function normalizePagination(query) {
  const page = Math.max(1, parseInt(query.page, 10) || 1);
  const limit = Math.min(MAX_LIMIT, Math.max(1, parseInt(query.limit, 10) || DEFAULT_LIMIT));
  const offset = (page - 1) * limit;
  return { page, limit, offset };
}

function serializeCourse(course) {
  const raw = course.get ? course.get({ plain: true }) : course;
  return {
    id: raw.id,
    title: raw.name,
    provider: raw.provider,
    externalUrl: raw.external_url,
    category: raw.category,
    difficulty: raw.difficulty,
    estimatedDurationMonths: raw.estimated_duration_months,
    description: raw.description,
    prerequisites: raw.prerequisites,
    status: raw.is_active ? 'active' : 'archived',
    createdBy: raw.created_by,
    createdAt: raw.created_at,
    updatedAt: raw.updated_at,
    enrolledCount: Number(raw.enrolled_count || 0),
  };
}

function serializeAssignment(row) {
  const raw = row.get ? row.get({ plain: true }) : row;
  return {
    id: raw.id,
    courseId: raw.course_id,
    employeeId: raw.employee_id,
    employeeName: raw.employee ? `${raw.employee.first_name} ${raw.employee.last_name}`.trim() : null,
    assignedBy: raw.assigned_by,
    assignedDate: raw.assigned_date,
    dueDate: raw.due_date,
    status: raw.status,
    completionDate: raw.completion_date,
    notes: raw.notes,
  };
}

function serializeEmployeeAssignment(row) {
  const raw = row.get ? row.get({ plain: true }) : row;
  return {
    id: raw.id,
    courseId: raw.course_id,
    courseTitle: raw.course?.name ?? null,
    courseCategory: raw.course?.category ?? null,
    courseDifficulty: raw.course?.difficulty ?? null,
    employeeId: raw.employee_id,
    employeeName: raw.employee ? `${raw.employee.first_name} ${raw.employee.last_name}`.trim() : null,
    employeeEmail: raw.employee?.email ?? null,
    assignedBy: raw.assigned_by,
    assignedDate: raw.assigned_date,
    dueDate: raw.due_date,
    status: raw.status,
    completionDate: raw.completion_date,
    notes: raw.notes,
  };
}

function serializeMyAssignment(row) {
  const raw = row.get ? row.get({ plain: true }) : row;
  return {
    id: raw.id,
    courseId: raw.course_id,
    employeeId: raw.employee_id,
    assignedDate: raw.assigned_date,
    dueDate: raw.due_date,
    status: raw.status,
    completionDate: raw.completion_date,
    notes: raw.notes,
    course: raw.course
      ? {
          id: raw.course.id,
          title: raw.course.name,
          provider: raw.course.provider,
          externalUrl: raw.course.external_url,
          category: raw.course.category,
          difficulty: raw.course.difficulty,
          estimatedDurationMonths: raw.course.estimated_duration_months,
          description: raw.course.description,
          prerequisites: raw.course.prerequisites,
        }
      : null,
    assignedBy: raw.assignedBy
      ? {
          id: raw.assignedBy.id,
          fullName: `${raw.assignedBy.first_name} ${raw.assignedBy.last_name}`.trim(),
          email: raw.assignedBy.email,
        }
      : null,
  };
}

function getActorRoles(actor) {
  if (!actor) return [];
  const roles = Array.isArray(actor.roles) ? actor.roles : [actor.role];
  return roles
    .filter(Boolean)
    .map((role) => String(role).toLowerCase());
}

function isAdminActor(actor) {
  const roles = getActorRoles(actor);
  const systemRole = String(actor?.systemRole || '').toLowerCase();
  return roles.includes('admin') || systemRole === 'admin';
}

async function getManagedEmployeeIds(managerId) {
  const rows = await sequelize.query(
    `
    WITH RECURSIVE team AS (
      SELECT id
      FROM employees
      WHERE manager_id = :managerId

      UNION ALL

      SELECT e.id
      FROM employees e
      INNER JOIN team t ON e.manager_id = t.id
    )
    SELECT DISTINCT id
    FROM team
    `,
    { replacements: { managerId }, type: QueryTypes.SELECT }
  );

  return rows.map((row) => Number(row.id)).filter((id) => Number.isFinite(id));
}

async function getManagerScopeOrThrow(actor) {
  const managedIds = await getManagedEmployeeIds(actor.id);
  if (!managedIds.length) {
    throw new AppError('Manager scope not found. No direct or indirect reports available.', 403, 'FORBIDDEN');
  }
  return managedIds;
}

async function findCourseOrThrow(courseId) {
  const course = await Course.scope('all').findByPk(courseId);
  if (!course) throw new NotFoundError('Course');
  return course;
}

function getActorIdOrThrow(actor) {
  const actorId = Number(actor?.id);
  if (!actorId) {
    throw new AppError('Unauthorized', 401, 'UNAUTHORIZED');
  }
  return actorId;
}

function getMyAssignmentInclude() {
  return [
    {
      model: Course,
      as: 'course',
      attributes: [
        'id',
        'name',
        'provider',
        'external_url',
        'category',
        'difficulty',
        'estimated_duration_months',
        'description',
        'prerequisites',
      ],
      required: true,
    },
    {
      model: Employee,
      as: 'assignedBy',
      attributes: ['id', 'first_name', 'last_name', 'email'],
      required: false,
    },
  ];
}

async function getCourses(query) {
  const { page, limit, offset } = normalizePagination(query);
  const where = {};
  const search = query.search?.trim();
  const category = query.category?.trim();
  const difficulty = query.difficulty;
  const status = query.status || 'active';

  if (search) {
    where[Op.or] = [
      { name: { [Op.iLike]: `%${search}%` } },
      { provider: { [Op.iLike]: `%${search}%` } },
    ];
  }
  if (category) where.category = category;
  if (difficulty) where.difficulty = difficulty;
  where.is_active = status === 'archived' ? false : true;

  const total = await Course.scope('all').count({ where });

  const data = await Course.scope('all').findAll({
    where,
    attributes: {
      include: [[literal('(SELECT COUNT(*) FROM course_assignments ca WHERE ca.course_id = "Course"."id")'), 'enrolled_count']],
    },
    order: [['created_at', 'DESC']],
    limit,
    offset,
  });

  return {
    data: data.map(serializeCourse),
    meta: {
      total,
      page,
      limit,
      pages: Math.ceil(total / limit),
    },
  };
}

async function createCourse(payload, actor, req) {
  const course = await Course.create({
    name: payload.title,
    provider: payload.provider || null,
    external_url: payload.externalUrl || null,
    category: payload.category || null,
    difficulty: payload.difficulty,
    estimated_duration_months: payload.estimatedDurationMonths ?? null,
    description: payload.description || null,
    prerequisites: payload.prerequisites || null,
    is_active: true,
    created_by: actor.id,
  });

  logActivity({
    employeeId: actor.id,
    actionType: LOG_ACTIONS.COURSE_CREATED,
    actionDescription: `Course "${course.name}" created by ${actor.email}`,
    targetType: 'course',
    targetId: course.id,
    metadata: { course_name: course.name },
    req,
  });

  const withCount = await Course.scope('all').findByPk(course.id, {
    attributes: {
      include: [[literal('(SELECT COUNT(*) FROM course_assignments ca WHERE ca.course_id = "Course"."id")'), 'enrolled_count']],
    },
  });

  return serializeCourse(withCount);
}

async function updateCourse(courseId, payload) {
  const course = await findCourseOrThrow(courseId);

  if (!course.is_active) {
    throw new AppError('Archived courses cannot be updated', 422, 'VALIDATION_ERROR');
  }

  await course.update({
    ...(payload.title !== undefined ? { name: payload.title } : {}),
    ...(payload.provider !== undefined ? { provider: payload.provider || null } : {}),
    ...(payload.externalUrl !== undefined ? { external_url: payload.externalUrl || null } : {}),
    ...(payload.category !== undefined ? { category: payload.category || null } : {}),
    ...(payload.difficulty !== undefined ? { difficulty: payload.difficulty } : {}),
    ...(payload.estimatedDurationMonths !== undefined ? { estimated_duration_months: payload.estimatedDurationMonths } : {}),
    ...(payload.description !== undefined ? { description: payload.description || null } : {}),
    ...(payload.prerequisites !== undefined ? { prerequisites: payload.prerequisites || null } : {}),
  });

  const withCount = await Course.scope('all').findByPk(course.id, {
    attributes: {
      include: [[literal('(SELECT COUNT(*) FROM course_assignments ca WHERE ca.course_id = "Course"."id")'), 'enrolled_count']],
    },
  });

  return serializeCourse(withCount);
}

async function archiveCourse(courseId, actor, req) {
  const course = await findCourseOrThrow(courseId);

  if (!course.is_active) {
    return {
      message: 'Course already archived',
      data: serializeCourse(course),
    };
  }

  await course.update({ is_active: false });

  logActivity({
    employeeId: actor.id,
    actionType: LOG_ACTIONS.COURSE_ARCHIVED,
    actionDescription: `Course "${course.name}" archived by ${actor.email}`,
    targetType: 'course',
    targetId: course.id,
    metadata: { course_name: course.name },
    req,
  });

  return {
    message: 'Course archived successfully',
    data: serializeCourse(course),
  };
}

async function getCourseAssignments(courseId, query, actor) {
  await findCourseOrThrow(courseId);

  const { page, limit, offset } = normalizePagination(query);
  const where = { course_id: Number(courseId) };
  if (query.status) where.status = query.status;

  if (actor && !isAdminActor(actor)) {
    const managedIds = await getManagerScopeOrThrow(actor);
    where.employee_id = { [Op.in]: managedIds };
  }

  const total = await CourseAssignment.count({ where });

  const rows = await CourseAssignment.findAll({
    where,
    include: [
      {
        model: Employee,
        as: 'employee',
        attributes: ['id', 'first_name', 'last_name'],
      },
    ],
    order: [['assigned_date', 'DESC'], ['id', 'DESC']],
    limit,
    offset,
  });

  return {
    data: rows.map(serializeAssignment),
    meta: {
      total,
      page,
      limit,
      pages: Math.ceil(total / limit),
    },
  };
}

async function bulkAssignCourse(courseId, payload, actor, req) {
  const employeeIds = payload.employeeIds.map(Number);
  const uniqueIds = [...new Set(employeeIds)];
  if (uniqueIds.length !== employeeIds.length) {
    throw new AppError('employeeIds must not contain duplicates', 400, 'VALIDATION_ERROR');
  }

  if (uniqueIds.includes(Number(actor.id))) {
    throw new AppError('Self-assignment is not allowed', 422, 'VALIDATION_ERROR');
  }

  if (!isAdminActor(actor)) {
    const managedIds = await getManagerScopeOrThrow(actor);
    const allowedSet = new Set(managedIds.map((id) => Number(id)));
    const outOfScope = uniqueIds.filter((id) => !allowedSet.has(Number(id)));
    if (outOfScope.length) {
      throw new AppError(
        `Out-of-scope assignment blocked for employee IDs: ${outOfScope.join(', ')}`,
        403,
        'FORBIDDEN'
      );
    }
  }

  const course = await findCourseOrThrow(courseId);
  if (!course.is_active) {
    throw new AppError('Archived courses cannot receive new assignments', 422, 'VALIDATION_ERROR');
  }

  const employees = await Employee.findAll({
    where: { id: { [Op.in]: uniqueIds }, is_active: true },
    include: [
      {
        model: Role,
        as: 'roles',
        through: { attributes: [] },
        attributes: ['id', 'name'],
      },
    ],
    attributes: ['id', 'first_name', 'last_name', 'email'],
  });

  if (employees.length !== uniqueIds.length) {
    const found = new Set(employees.map((e) => e.id));
    const missing = uniqueIds.filter((id) => !found.has(id));
    throw new AppError(`Some employees are missing or inactive: ${missing.join(', ')}`, 400, 'VALIDATION_ERROR');
  }

  const adminTargets = employees.filter((emp) =>
    (emp.roles || []).some((role) => String(role.name || '').toLowerCase() === 'admin')
  );
  if (adminTargets.length) {
    const blockedIds = adminTargets.map((emp) => emp.id);
    throw new AppError(`Course cannot be assigned to admin account(s): ${blockedIds.join(', ')}`, 422, 'VALIDATION_ERROR');
  }

  const existing = await CourseAssignment.findAll({
    where: {
      course_id: Number(courseId),
      employee_id: { [Op.in]: uniqueIds },
    },
    attributes: ['employee_id'],
  });

  if (existing.length) {
    const duplicateIds = existing.map((row) => row.employee_id);
    throw new ConflictError(`Duplicate assignment blocked for employee IDs: ${duplicateIds.join(', ')}`);
  }

  const createdAssignments = await withTransaction(async (transaction) => {
    await CourseAssignment.bulkCreate(
      uniqueIds.map((employeeId) => ({
        course_id: Number(courseId),
        employee_id: employeeId,
        assigned_by: actor.id,
        due_date: payload.dueDate || null,
        notes: payload.notes || null,
        status: 'assigned',
        completion_date: null,
      })),
      { transaction }
    );

    return CourseAssignment.findAll({
      where: {
        course_id: Number(courseId),
        employee_id: { [Op.in]: uniqueIds },
      },
      include: [{ model: Employee, as: 'employee', attributes: ['id', 'first_name', 'last_name'] }],
      order: [['id', 'DESC']],
      transaction,
    });
  });

  logActivity({
    employeeId: actor.id,
    actionType: LOG_ACTIONS.COURSE_ASSIGNED,
    actionDescription: `Course "${course.name}" assigned to ${uniqueIds.length} employees by ${actor.email}`,
    targetType: 'course',
    targetId: course.id,
    metadata: {
      employee_ids: uniqueIds,
      due_date: payload.dueDate || null,
    },
    req,
  });

  return {
    data: createdAssignments.map(serializeAssignment),
    meta: {
      assignedCount: createdAssignments.length,
    },
  };
}

async function cancelAssignment(courseId, assignmentId, actor) {
  await findCourseOrThrow(courseId);

  const assignment = await CourseAssignment.findOne({
    where: {
      id: Number(assignmentId),
      course_id: Number(courseId),
    },
    include: [{ model: Employee, as: 'employee', attributes: ['id', 'first_name', 'last_name'] }],
  });

  if (!assignment) throw new NotFoundError('Assignment');

  if (actor && !isAdminActor(actor)) {
    const managedIds = await getManagerScopeOrThrow(actor);
    if (!managedIds.includes(Number(assignment.employee_id))) {
      throw new AppError('You can only cancel assignments for your direct or indirect team.', 403, 'FORBIDDEN');
    }
  }

  if (assignment.status === 'completed') {
    throw new AppError('Completed assignment cannot be cancelled', 422, 'VALIDATION_ERROR');
  }

  if (assignment.status !== 'cancelled') {
    await assignment.update({ status: 'cancelled', completion_date: null });
  }

  return serializeAssignment(assignment);
}

async function getEligibleEmployees(query, actor) {
  const { page, limit, offset } = normalizePagination(query);
  const search = query.search?.trim();
  const role = query.role?.trim();
  const department = query.department?.trim();
  const jobTitle = query.jobTitle?.trim();

  const where = { is_active: true };
  const andConditions = [
    literal(`NOT EXISTS (SELECT 1 FROM employee_roles er JOIN roles r ON r.id = er.role_id WHERE er.employee_id = "Employee"."id" AND LOWER(r.name) = 'admin')`),
  ];
  if (actor?.id) {
    andConditions.push({ id: { [Op.ne]: Number(actor.id) } });
  }

  if (actor && !isAdminActor(actor)) {
    const managedIds = await getManagerScopeOrThrow(actor);
    andConditions.push({ id: { [Op.in]: managedIds } });
  }

  where[Op.and] = andConditions;

  if (search) {
    where[Op.or] = [
      { first_name: { [Op.iLike]: `%${search}%` } },
      { last_name: { [Op.iLike]: `%${search}%` } },
      { email: { [Op.iLike]: `%${search}%` } },
      { employee_number: { [Op.iLike]: `%${search}%` } },
    ];
  }
  if (jobTitle) where.job_title = { [Op.iLike]: `%${jobTitle}%` };

  const roleWhere = {};
  if (query.role_id) roleWhere.id = Number(query.role_id);
  if (role) roleWhere.name = { [Op.iLike]: role };

  const roleInclude = {
    model: Role,
    as: 'roles',
    through: { attributes: [] },
    attributes: ['id', 'name'],
    required: Boolean(role || query.role_id),
    ...(Object.keys(roleWhere).length ? { where: roleWhere } : {}),
  };

  const departmentWhere = {};
  if (query.department_id) departmentWhere.id = Number(query.department_id);
  if (department) departmentWhere.name = { [Op.iLike]: department };

  const departmentInclude = {
    model: Department,
    as: 'department',
    attributes: ['id', 'name'],
    required: Boolean(department || query.department_id),
    ...(Object.keys(departmentWhere).length ? { where: departmentWhere } : {}),
  };

  const total = await Employee.scope('withInactive').count({
    where,
    include: [roleInclude, departmentInclude],
    distinct: true,
    col: 'id',
  });

  const rows = await Employee.scope('withInactive').findAll({
    where,
    include: [roleInclude, departmentInclude],
    attributes: ['id', 'employee_number', 'first_name', 'last_name', 'email', 'job_title'],
    order: [['first_name', 'ASC'], ['last_name', 'ASC']],
    limit,
    offset,
    subQuery: false,
  });

  return {
    data: rows.map((row) => ({
      id: row.id,
      employeeNumber: row.employee_number,
      fullName: `${row.first_name} ${row.last_name}`.trim(),
      email: row.email,
      jobTitle: row.job_title,
      department: row.department ? row.department.name : null,
      roles: (row.roles || []).map((r) => ({ id: r.id, name: r.name })),
    })),
    meta: {
      total,
      page,
      limit,
      pages: Math.ceil(total / limit),
    },
  };
}

async function getEmployeeAssignments(query, actor) {
  const { page, limit, offset } = normalizePagination(query);
  const search = query.search?.trim();
  const employeeId = query.employeeId ? Number(query.employeeId) : null;

  const where = {};
  if (query.status) where.status = query.status;
  if (employeeId) where.employee_id = employeeId;

  if (actor && !isAdminActor(actor)) {
    const managedIds = await getManagerScopeOrThrow(actor);
    if (employeeId && !managedIds.includes(employeeId)) {
      throw new AppError('Selected employee is outside your team scope.', 403, 'FORBIDDEN');
    }
    where.employee_id = employeeId
      ? employeeId
      : { [Op.in]: managedIds };
  }

  const include = [
    {
      model: Employee,
      as: 'employee',
      attributes: ['id', 'first_name', 'last_name', 'email'],
      required: true,
    },
    {
      model: Course,
      as: 'course',
      attributes: ['id', 'name', 'category', 'difficulty'],
      required: true,
    },
  ];

  if (search) {
    where[Op.or] = [
      { '$employee.first_name$': { [Op.iLike]: `%${search}%` } },
      { '$employee.last_name$': { [Op.iLike]: `%${search}%` } },
      { '$employee.email$': { [Op.iLike]: `%${search}%` } },
      { '$course.name$': { [Op.iLike]: `%${search}%` } },
    ];
  }

  const total = await CourseAssignment.count({
    where,
    include,
    distinct: true,
    col: 'id',
  });

  const rows = await CourseAssignment.findAll({
    where,
    include,
    order: [['assigned_date', 'DESC'], ['id', 'DESC']],
    limit,
    offset,
    subQuery: false,
  });

  return {
    data: rows.map(serializeEmployeeAssignment),
    meta: {
      total,
      page,
      limit,
      pages: Math.ceil(total / limit),
    },
  };
}

async function getMyAssignments(query, actor) {
  const actorId = getActorIdOrThrow(actor);
  const { page, limit, offset } = normalizePagination(query);
  const search = query.search?.trim();

  const where = {
    employee_id: actorId,
  };

  if (query.status) where.status = query.status;

  const include = getMyAssignmentInclude();

  if (search) {
    where[Op.or] = [
      { '$course.name$': { [Op.iLike]: `%${search}%` } },
      { '$course.provider$': { [Op.iLike]: `%${search}%` } },
      { '$course.category$': { [Op.iLike]: `%${search}%` } },
    ];
  }

  const total = await CourseAssignment.count({
    where,
    include,
    distinct: true,
    col: 'id',
  });

  const rows = await CourseAssignment.findAll({
    where,
    include,
    order: [['assigned_date', 'DESC'], ['id', 'DESC']],
    limit,
    offset,
    subQuery: false,
  });

  return {
    data: rows.map(serializeMyAssignment),
    meta: {
      total,
      page,
      limit,
      pages: Math.ceil(total / limit),
    },
  };
}

async function getMyAssignmentDetail(assignmentId, actor) {
  const actorId = getActorIdOrThrow(actor);

  const row = await CourseAssignment.findOne({
    where: {
      id: Number(assignmentId),
      employee_id: actorId,
    },
    include: getMyAssignmentInclude(),
  });

  if (!row) throw new NotFoundError('Assignment');

  return serializeMyAssignment(row);
}

async function startMyAssignment(assignmentId, actor, req) {
  const actorId = getActorIdOrThrow(actor);

  const assignment = await CourseAssignment.findOne({
    where: {
      id: Number(assignmentId),
      employee_id: actorId,
    },
    include: getMyAssignmentInclude(),
  });

  if (!assignment) throw new NotFoundError('Assignment');

  if (assignment.status === 'cancelled') {
    throw new AppError('Cancelled assignment cannot be started', 422, 'VALIDATION_ERROR');
  }

  if (assignment.status === 'completed') {
    throw new AppError('Completed assignment cannot be started', 422, 'VALIDATION_ERROR');
  }

  if (assignment.status !== 'assigned') {
    throw new AppError('Only assigned courses can be started', 422, 'VALIDATION_ERROR');
  }

  await assignment.update({
    status: 'in_progress',
    completion_date: null,
  });

  logActivity({
    employeeId: actorId,
    actionType: LOG_ACTIONS.COURSE_STARTED,
    actionDescription: `Course "${assignment.course?.name || assignment.course_id}" started by ${actor.email}`,
    targetType: 'course_assignment',
    targetId: assignment.id,
    metadata: {
      course_id: assignment.course_id,
      assignment_id: assignment.id,
    },
    req,
  });

  return serializeMyAssignment(assignment);
}

async function completeMyAssignment(assignmentId, actor, req) {
  const actorId = getActorIdOrThrow(actor);

  const assignment = await CourseAssignment.findOne({
    where: {
      id: Number(assignmentId),
      employee_id: actorId,
    },
    include: getMyAssignmentInclude(),
  });

  if (!assignment) throw new NotFoundError('Assignment');

  if (assignment.status === 'cancelled') {
    throw new AppError('Cancelled assignment cannot be completed', 422, 'VALIDATION_ERROR');
  }

  if (assignment.status === 'completed') {
    throw new AppError('Assignment already completed', 422, 'VALIDATION_ERROR');
  }

  if (assignment.status !== 'in_progress') {
    throw new AppError('Only in-progress courses can be completed', 422, 'VALIDATION_ERROR');
  }

  await assignment.update({
    status: 'completed',
    completion_date: new Date(),
  });

  logActivity({
    employeeId: actorId,
    actionType: LOG_ACTIONS.COURSE_COMPLETED,
    actionDescription: `Course "${assignment.course?.name || assignment.course_id}" completed by ${actor.email}`,
    targetType: 'course_assignment',
    targetId: assignment.id,
    metadata: {
      course_id: assignment.course_id,
      assignment_id: assignment.id,
    },
    req,
  });

  return serializeMyAssignment(assignment);
}

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
};
