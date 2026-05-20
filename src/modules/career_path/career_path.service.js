'use strict';

const { Op } = require('sequelize');
const { IdealRole, CareerPath, CareerPathStepCourse, Course, CourseAssignment, Employee, OrgRole } = require('../../models');
const { NotFoundError, ForbiddenError, AppError } = require('../../core/errors/AppError');

// ── helpers ───────────────────────────────────────────────────────────────────

function formatDate(value) {
  if (!value) return null;
  const d = new Date(value);
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

// ── getCareerPath — simple timeline (no employee context) ─────────────────────

async function getCareerPath(idealRoleId) {
  const idealRole = await IdealRole.findByPk(idealRoleId, {
    include: [
      {
        model:      CareerPath,
        as:         'careerPathSteps',
        attributes: ['id', 'step_order', 'role_title'],
      },
    ],
  });

  if (!idealRole) {
    throw new NotFoundError(`Ideal role with id ${idealRoleId} not found`);
  }

  const steps = [...idealRole.careerPathSteps].sort((a, b) => a.step_order - b.step_order);

  return {
    ideal_role: { id: idealRole.id, role_name: idealRole.role_name },
    steps: steps.map((s) => ({
      id:         s.id,
      step_order: s.step_order,
      role_title: s.role_title,
      status:     'upcoming',
    })),
  };
}

// ── getMyCareerProgress — full progress with course data ──────────────────────

async function getMyCareerProgress(idealRoleId, employeeId) {
  // 1. Load employee — include orgRole for position auto-detection
  const employee = await Employee.scope('withInactive').findByPk(employeeId, {
    attributes: ['id', 'current_career_path_id'],
    include: [{ model: OrgRole, as: 'orgRole', attributes: ['role_name'] }],
  });
  if (!employee) throw new NotFoundError('Employee');

  const currentCareerPathId = employee.current_career_path_id;

  // 2. Load ideal role + steps only — no nested course include so this never
  //    fails even if career_path_step_courses table hasn't been migrated yet
  const idealRole = await IdealRole.findByPk(idealRoleId, {
    include: [
      {
        model:      CareerPath,
        as:         'careerPathSteps',
        attributes: ['id', 'step_order', 'role_title'],
      },
    ],
  });

  if (!idealRole) throw new NotFoundError(`Ideal role with id ${idealRoleId} not found`);

  const steps = [...idealRole.careerPathSteps].sort((a, b) => a.step_order - b.step_order);
  const stepIds = steps.map((s) => s.id);

  // 3. Load course data via junction table — wrapped in try/catch so the whole
  //    endpoint still works if the migration hasn't been run yet
  let stepCourseMap = new Map(); // career_path_id → Course[]
  let assignmentMap = new Map(); // course_id → CourseAssignment

  try {
    if (stepIds.length) {
      const junctionRows = await CareerPathStepCourse.findAll({
        where:      { career_path_id: { [Op.in]: stepIds } },
        attributes: ['career_path_id', 'course_id'],
      });

      const allCourseIds = [...new Set(junctionRows.map((r) => r.course_id))];

      if (allCourseIds.length) {
        const [courses, assignments] = await Promise.all([
          Course.findAll({
            where:      { id: { [Op.in]: allCourseIds } },
            attributes: ['id', 'name', 'category'],
          }),
          CourseAssignment.findAll({
            where:      { employee_id: employeeId, course_id: { [Op.in]: allCourseIds } },
            attributes: ['course_id', 'status', 'completion_date'],
          }),
        ]);

        const courseById = new Map(courses.map((c) => [c.id, c]));
        assignmentMap   = new Map(assignments.map((a) => [a.course_id, a]));

        for (const row of junctionRows) {
          const course = courseById.get(row.course_id);
          if (!course) continue;
          if (!stepCourseMap.has(row.career_path_id)) stepCourseMap.set(row.career_path_id, []);
          stepCourseMap.get(row.career_path_id).push(course);
        }
      }
    }
  } catch (_err) {
    // course data unavailable — steps still render, courses degrade to empty arrays
  }

  // 4. Determine effective current step
  // If DB has a value, use it. Otherwise fall back to org_role → role_title match
  // so employees who haven't been manually placed yet still see their correct position.
  let effectiveCareerPathId = currentCareerPathId;
  if (!effectiveCareerPathId && employee.orgRole?.role_name) {
    const orgRoleLower = employee.orgRole.role_name.trim().toLowerCase();
    const matched = steps.find((s) => s.role_title.trim().toLowerCase() === orgRoleLower);
    if (matched) effectiveCareerPathId = matched.id;
  }

  const currentIdx = effectiveCareerPathId
    ? steps.findIndex((s) => s.id === effectiveCareerPathId)
    : -1;

  // 5. Build result per step
  const builtSteps = steps.map((step, idx) => {
    let status;
    if (currentIdx === -1) {
      status = 'upcoming';
    } else if (idx < currentIdx) {
      status = 'completed';
    } else if (idx === currentIdx) {
      status = 'current';
    } else {
      status = 'upcoming';
    }

    const stepCourses = stepCourseMap.get(step.id) ?? [];

    const completedCourses = stepCourses
      .filter((c) => assignmentMap.get(c.id)?.status === 'completed')
      .map((c) => ({
        id:          c.id,
        name:        c.name,
        type:        c.category || 'Course',
        completedOn: formatDate(assignmentMap.get(c.id)?.completion_date),
      }));

    return {
      id:                   step.id,
      step_order:           step.step_order,
      role_title:           step.role_title,
      status,
      completedCourses,
      nextRoleRequirements: [],
    };
  });

  // 6. Fill nextRoleRequirements for each step (courses required by the NEXT step)
  for (let i = 0; i < builtSteps.length - 1; i++) {
    const nextCourses = stepCourseMap.get(steps[i + 1].id) ?? [];
    builtSteps[i].nextRoleRequirements = nextCourses.map((c) => {
      const assignment = assignmentMap.get(c.id);
      return {
        id:     c.id,
        name:   c.name,
        type:   c.category || 'Course',
        status: assignment?.status === 'completed' ? 'Completed' : 'Pending',
      };
    });
  }

  return {
    ideal_role:              { id: idealRole.id, role_name: idealRole.role_name },
    current_career_path_id:  currentCareerPathId,
    steps:                   builtSteps,
  };
}

// ── promoteEmployeeStep — manager advances an employee ────────────────────────

async function promoteEmployeeStep(employeeId, careerPathId, actor) {
  // 1. Load target employee (withInactive to be safe)
  const targetEmployee = await Employee.scope('withInactive').findByPk(employeeId, {
    attributes: ['id', 'manager_id', 'ideal_role_id', 'current_career_path_id'],
  });
  if (!targetEmployee) throw new NotFoundError('Employee');

  // 2. Authorisation: actor must be the employee's direct manager OR admin
  const actorSystemRole = String(actor.systemRole || '').toLowerCase();
  const isAdmin   = actorSystemRole === 'admin' || (actor.roles || []).includes('admin');
  const isManager = targetEmployee.manager_id === actor.id;

  if (!isAdmin && !isManager) {
    throw new ForbiddenError('Only the employee\'s direct manager or an admin can update career step');
  }

  // 3. Load the target career_path step
  const targetStep = await CareerPath.findByPk(careerPathId, {
    attributes: ['id', 'ideal_role_id', 'step_order'],
  });
  if (!targetStep) throw new NotFoundError('Career path step');

  // 4. Verify the step belongs to the employee's ideal_role
  if (!targetEmployee.ideal_role_id) {
    throw new AppError('Employee does not have an ideal role assigned', 422);
  }
  if (targetStep.ideal_role_id !== targetEmployee.ideal_role_id) {
    throw new AppError('Career path step does not belong to the employee\'s ideal role', 422);
  }

  // 5. Enforce sequential progression once a position has been set.
  // Initial placement (current_career_path_id is null) allows any step — managers
  // need to be able to onboard employees who are already mid-career.
  if (targetEmployee.current_career_path_id) {
    const currentStep = await CareerPath.findByPk(targetEmployee.current_career_path_id, {
      attributes: ['step_order'],
    });
    if (currentStep && targetStep.step_order !== currentStep.step_order + 1) {
      throw new AppError(
        `Cannot skip steps. Employee is at step ${currentStep.step_order}; target must be step ${currentStep.step_order + 1}`,
        422
      );
    }
  }

  // 6. Update
  await Employee.scope('withInactive').update(
    { current_career_path_id: careerPathId },
    { where: { id: employeeId } }
  );

  return {
    employee_id:              employeeId,
    current_career_path_id:   careerPathId,
    step_order:               targetStep.step_order,
  };
}

module.exports = { getCareerPath, getMyCareerProgress, promoteEmployeeStep };
