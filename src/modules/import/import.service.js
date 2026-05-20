'use strict';

/**
 * import.service.js
 * src/modules/import/import.service.js
 *
 * ┌────────────────────────────────────────────────────────────────────────────┐
 * │ Pass 1 — fetch system role ids (employee, manager, admin)                  │
 * │ Pass 2 — parallel preload: employees, admin ids, departments,              │
 * │           org_roles, ideal_roles, primary_tech_stacks                      │
 * │ Pass 3 — upsert employees                                                  │
 * │   3a  loop: resolve depts (sequential) + build toInsert / toUpdate arrays  │
 * │   3b  single Employee.bulkCreate  + single EmployeeRole.bulkCreate         │
 * │   3c  single bulk UPDATE for existing employees                            │
 * │ Pass 4 — manager_id resolution: collect pairs → one bulk UPDATE            │
 * │            Excel "PINT0097" (string) → empByNum.get() → integer id         │
 * │            String NEVER reaches Postgres                                   │
 * │ Pass 5 — soft delete: collect ids → one bulk UPDATE                        │
 * │            GUARD: admins NEVER soft deleted                                │
 * │ Pass 6 — system role re-evaluation (employee ↔ manager)                   │
 * │            collect toPromote / toDemote → two bulk UPDATEs                │
 * │            GUARD: admins NEVER touched                                     │
 * │            GUARD: custom roles (is_system_role=false) NEVER touched        │
 * └────────────────────────────────────────────────────────────────────────────┘
 */

const { QueryTypes }  = require('sequelize');
const { sequelize, withTransaction }   = require('../../core/config/database');
const Employee        = require('../../models/Employee');
const Department      = require('../../models/Department');
const Role            = require('../../models/Role');
const EmployeeRole    = require('../../models/EmployeeRole');
const logger          = require('../../core/utils/logger');

const OPERATION = 'EMPLOYEE_IMPORT';
const IMPORT_MAX_PRELOAD_EMPLOYEES = parseInt(process.env.IMPORT_MAX_PRELOAD_EMPLOYEES) || 20000;

// ── Department helpers ────────────────────────────────────────────────────────

function generateDeptCode(name) {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length === 1) return words[0].substring(0, 3).toUpperCase();
  return words.map((w) => w[0]).join('').toUpperCase().substring(0, 20);
}

function resolveUniqueCode(base, existingCodes) {
  if (!existingCodes.has(base)) return base;
  let n = 1;
  while (existingCodes.has(`${base}_${n}`)) n++;
  return `${base}_${n}`;
}

async function getOrCreateDepartment(name, nameCache, existingCodes, t) {
  const key = name.trim().toLowerCase();
  if (nameCache.has(key)) return nameCache.get(key);

  const existing = await Department.findOne({
    where:       sequelize.where(sequelize.fn('LOWER', sequelize.col('name')), key),
    attributes:  ['id', 'code'],
    transaction: t,
  });

  if (existing) {
    nameCache.set(key, existing.id);
    return existing.id;
  }

  const uniqueCode = resolveUniqueCode(generateDeptCode(name.trim()), existingCodes);
  const newDept    = await Department.create(
    { name: name.trim(), code: uniqueCode, is_active: true },
    { transaction: t }
  );

  existingCodes.add(uniqueCode);
  nameCache.set(key, newDept.id);
  return newDept.id;
}

// ── System role helpers ───────────────────────────────────────────────────────

async function getSystemRoleIds(t) {
  const roles = await Role.findAll({
    where:       { name: ['employee', 'manager', 'admin'], is_system_role: true },
    attributes:  ['id', 'name'],
    transaction: t,
  });

  const map = {};
  roles.forEach((r) => { map[r.name] = r.id; });

  if (!map.employee || !map.manager || !map.admin) {
    throw new Error("System roles 'employee', 'manager', 'admin' not found — run the roles seeder first.");
  }
  return map;
}

// ── Pre-validation DB lookup ──────────────────────────────────────────────────

async function fetchExistingEmailMap() {
  const employees = await Employee.scope('withInactive').findAll({
    attributes: ['employee_number', 'email'],
  });
  return new Map(
    employees.map((e) => [e.email.toLowerCase(), e.employee_number.toUpperCase()])
  );
}

// ── Main export ───────────────────────────────────────────────────────────────

async function processRows(validRows, { loggerContext = {} } = {}) {
  const context = { ...loggerContext, operation: OPERATION };

  // ── Pre-flight: employee table size guard ─────────────────────────────────
  const [{ cnt }] = await sequelize.query(
    `SELECT COUNT(*) AS cnt FROM employees`,
    { type: QueryTypes.SELECT }
  );
  const employeeCount = parseInt(cnt, 10);
  if (employeeCount > IMPORT_MAX_PRELOAD_EMPLOYEES) {
    throw Object.assign(
      new Error(
        `Employee table has ${employeeCount.toLocaleString()} records, which exceeds the ` +
        `in-memory preload limit of ${IMPORT_MAX_PRELOAD_EMPLOYEES.toLocaleString()}. ` +
        `Set IMPORT_MAX_PRELOAD_EMPLOYEES to a higher value or contact your system administrator ` +
        `to run a server-side bulk import.`
      ),
      { statusCode: 422 }
    );
  }

  const summary = await withTransaction(async (t) => {
    const deptNameCache    = new Map();
    let   inserted         = 0;
    let   updated          = 0;
    let   softDeleted      = 0;
    const softDeletedEmps  = [];
    const promotedToManager = [];
    const demotedToEmployee = [];
    const managerWarnings  = [];
    const newlyInsertedById = new Map(); // id → employee_number  (Pass 6 fallback)

    // ── Pass 1: System role IDs (sequential — admin query in Pass 2 depends on it) ──
    logger.info('Import pass 1: Fetching system roles', { ...context, step: 'pass1_system_roles' });
    const systemRoleIds = await getSystemRoleIds(t);

    // ── Pass 2: Parallel preload of all reference data ────────────────────────
    logger.info('Import pass 2: Parallel preload', { ...context, step: 'pass2_preload' });
    const [
      existingEmployees,
      adminRows,
      existingDepts,
      orgRoleRecords,
      idealRoleRecords,
      techStackRecords,
      careerPathStepRecords,
    ] = await Promise.all([
      Employee.scope('withInactive').findAll({
        attributes:  ['id', 'employee_number', 'email', 'is_active'],
        transaction: t,
      }),
      sequelize.query(
        `SELECT er.employee_id FROM employee_roles er WHERE er.role_id = :adminRoleId`,
        { replacements: { adminRoleId: systemRoleIds.admin }, type: QueryTypes.SELECT, transaction: t }
      ),
      Department.unscoped().findAll({
        attributes:  ['id', 'name', 'code'],
        transaction: t,
      }),
      sequelize.query(
        `SELECT id, role_name FROM org_roles WHERE is_active = true`,
        { type: QueryTypes.SELECT, transaction: t }
      ),
      sequelize.query(
        `SELECT id, role_name, department_id FROM ideal_roles`,
        { type: QueryTypes.SELECT, transaction: t }
      ),
      sequelize.query(
        `SELECT id, name FROM primary_tech_stacks WHERE is_active = true`,
        { type: QueryTypes.SELECT, transaction: t }
      ),
      sequelize.query(
        `SELECT id, ideal_role_id, role_title FROM career_paths`,
        { type: QueryTypes.SELECT, transaction: t }
      ).catch(() => []), // graceful if table not yet migrated
    ]);

    // ── Build in-memory maps from preloaded data ──────────────────────────────
    const empByNum = new Map(
      existingEmployees.map((e) => [
        e.employee_number.toUpperCase(),
        { id: e.id, email: e.email.toLowerCase(), is_active: e.is_active },
      ])
    );
    const empByEmail   = new Map(existingEmployees.map((e) => [e.email.toLowerCase(), { id: e.id }]));
    const empNumById   = new Map(existingEmployees.map((e) => [e.id, e.employee_number]));
    const adminEmployeeIds = new Set(adminRows.map((r) => r.employee_id));

    const existingDeptCodes = new Set();
    existingDepts.forEach((d) => {
      if (d.code) existingDeptCodes.add(d.code.toUpperCase());
      deptNameCache.set(d.name.trim().toLowerCase(), d.id);
    });

    const orgRoleMap  = new Map(orgRoleRecords.map((r) => [r.role_name.toLowerCase(), r.id]));
    const techStackMap = new Map(techStackRecords.map((r) => [r.name.toLowerCase(), r.id]));

    const idealRoleMap = new Map();
    for (const r of idealRoleRecords) {
      const key = r.role_name.toLowerCase();
      if (!idealRoleMap.has(key)) idealRoleMap.set(key, []);
      idealRoleMap.get(key).push({ id: r.id, department_id: r.department_id });
    }

    // Map<ideal_role_id, Map<role_title_lower, career_path_step_id>>
    // Used to auto-detect current_career_path_id from job_title during import
    const careerStepByIdealRole = new Map();
    for (const step of careerPathStepRecords) {
      if (!careerStepByIdealRole.has(step.ideal_role_id)) {
        careerStepByIdealRole.set(step.ideal_role_id, new Map());
      }
      careerStepByIdealRole.get(step.ideal_role_id).set(step.role_title.trim().toLowerCase(), step.id);
    }

    const fileEmpNums = new Set(validRows.map((r) => r.employee_number.toUpperCase()));

    // ── Pass 3a: Build payloads — dept creation stays sequential ─────────────
    logger.info('Import pass 3: Upserting employees', { ...context, step: 'pass3_upsert' });
    const toInsert = []; // { empNum, email, payload }
    const toUpdate = []; // { id, payload }

    for (const row of validRows) {
      const empNum = row.employee_number.toUpperCase();
      const email  = row.email.toLowerCase();

      let departmentId;
      if (row.department?.trim()) {
        departmentId = await getOrCreateDepartment(row.department, deptNameCache, existingDeptCodes, t);
      }

      const payload = { email };
      if (row.first_name?.trim())      payload.first_name      = row.first_name.trim();
      if (row.last_name?.trim())       payload.last_name       = row.last_name.trim();
      if (row.job_title?.trim())       payload.job_title       = row.job_title.trim().substring(0, 150);
      if (row.band_identifier?.trim()) payload.band_identifier = row.band_identifier.trim().substring(0, 50);
      if (departmentId !== undefined)  payload.department_id   = departmentId;

      if (row.org_role_name?.trim()) {
        const id = orgRoleMap.get(row.org_role_name.trim().toLowerCase());
        if (id) {
          payload.org_role_id = id;
        } else {
          managerWarnings.push({ field: 'Org Role', message: `"${empNum}": org role "${row.org_role_name.trim()}" not found — org_role_id left unchanged` });
        }
      }

      if (row.ideal_role_name?.trim()) {
        const key     = row.ideal_role_name.trim().toLowerCase();
        const matches = idealRoleMap.get(key);
        if (matches?.length) {
          const hit = (departmentId != null ? matches.find((m) => m.department_id === departmentId) : null) ?? matches[0];
          payload.ideal_role_id = hit.id;
        } else {
          managerWarnings.push({ field: 'Ideal Role', message: `"${empNum}": ideal role "${row.ideal_role_name.trim()}" not found — ideal_role_id left unchanged` });
        }
      }

      if (row.primary_tech_stack_name?.trim()) {
        const id = techStackMap.get(row.primary_tech_stack_name.trim().toLowerCase());
        if (id) {
          payload.primary_tech_stack_id = id;
        } else {
          managerWarnings.push({ field: 'Primary Tech Stack', message: `"${empNum}": tech stack "${row.primary_tech_stack_name.trim()}" not found — primary_tech_stack_id left unchanged` });
        }
      }

      // Auto-detect current_career_path_id: match org_role_name against career path step role_titles.
      // For new employees this sets the initial position; for existing employees COALESCE in the
      // UPDATE query ensures we never overwrite a position that was already set manually.
      if (row.org_role_name?.trim() && payload.ideal_role_id) {
        const stepsByTitle = careerStepByIdealRole.get(payload.ideal_role_id);
        if (stepsByTitle) {
          const matchedStepId = stepsByTitle.get(row.org_role_name.trim().toLowerCase());
          if (matchedStepId) payload.current_career_path_id = matchedStepId;
        }
      }

      const existing = empByNum.get(empNum);
      if (existing) {
        toUpdate.push({ id: existing.id, payload });
      } else {
        toInsert.push({ empNum, email, payload });
      }
    }

    // ── Pass 3b: Bulk INSERT new employees + roles ────────────────────────────
    if (toInsert.length) {
      const created = await Employee.bulkCreate(
        toInsert.map((item) => ({ employee_number: item.empNum, is_active: true, password_hash: null, ...item.payload })),
        { transaction: t, returning: true }
      );

      await EmployeeRole.bulkCreate(
        created.map((e) => ({ employee_id: e.id, role_id: systemRoleIds.employee, is_primary: true })),
        { transaction: t }
      );

      for (const e of created) {
        const empNum = e.employee_number.toUpperCase();
        newlyInsertedById.set(e.id, empNum);
        empByNum.set(empNum, { id: e.id, email: e.email.toLowerCase(), is_active: true });
        empByEmail.set(e.email.toLowerCase(), { id: e.id });
      }
      inserted = created.length;
    }

    // ── Pass 3c: Single bulk UPDATE for existing employees ────────────────────
    if (toUpdate.length) {
      const valueRows = toUpdate.map((item) => [
        item.id,
        item.payload.first_name              ?? null,
        item.payload.last_name               ?? null,
        item.payload.email,
        item.payload.job_title               ?? null,
        item.payload.band_identifier         ?? null,
        item.payload.department_id           ?? null,
        item.payload.org_role_id             ?? null,
        item.payload.ideal_role_id           ?? null,
        item.payload.primary_tech_stack_id   ?? null,
        item.payload.current_career_path_id  ?? null,
      ]);

      const valuePlaceholders = valueRows
        .map(() => '(?::int, ?::text, ?::text, ?::text, ?::text, ?::text, ?::int, ?::int, ?::int, ?::int, ?::int)')
        .join(', ');

      await sequelize.query(
        `UPDATE employees AS e
         SET
           first_name              = COALESCE(v.fn,   e.first_name),
           last_name               = COALESCE(v.ln,   e.last_name),
           email                   = v.em,
           job_title               = COALESCE(v.jt,   e.job_title),
           band_identifier         = COALESCE(v.bi,   e.band_identifier),
           department_id           = COALESCE(v.dept, e.department_id),
           org_role_id             = COALESCE(v.ori,  e.org_role_id),
           ideal_role_id           = COALESCE(v.iri,  e.ideal_role_id),
           primary_tech_stack_id   = COALESCE(v.pti,  e.primary_tech_stack_id),
           current_career_path_id  = COALESCE(e.current_career_path_id, v.cpid),
           is_active               = true,
           updated_at              = NOW()
         FROM (VALUES ${valuePlaceholders})
           AS v(id, fn, ln, em, jt, bi, dept, ori, iri, pti, cpid)
         WHERE e.id = v.id`,
        { replacements: valueRows.flat(), type: QueryTypes.UPDATE, transaction: t }
      );
      updated = toUpdate.length;
    }

    // ── Pass 4: Bulk manager_id resolution ────────────────────────────────────
    logger.info('Import pass 4: Resolving managers', { ...context, step: 'pass4_manager_resolution' });
    const managerUpdates = []; // { empId, managerId }

    for (const row of validRows) {
      const empNum = row.employee_number.toUpperCase();
      const emp    = empByNum.get(empNum);
      if (!emp) continue;
      if (!row.manager_emp_number?.trim() && !row.reports_to_email?.trim()) continue;

      let managerId = null;

      if (row.manager_emp_number?.trim()) {
        const mgr = empByNum.get(row.manager_emp_number.toUpperCase());
        if (mgr) {
          managerId = mgr.id;
        } else {
          managerWarnings.push({ field: 'Manager Emp Number', message: `"${empNum}": manager "${row.manager_emp_number}" not found — manager_id left unchanged` });
        }
      } else if (row.reports_to_email?.trim()) {
        const mgr = empByEmail.get(row.reports_to_email.toLowerCase());
        if (mgr) {
          managerId = mgr.id;
        } else {
          managerWarnings.push({ field: 'Reports To Email', message: `"${empNum}": manager email "${row.reports_to_email}" not found — manager_id left unchanged` });
        }
      }

      if (managerId === null) continue;

      if (managerId === emp.id) {
        managerWarnings.push({ field: 'Manager Emp Number', message: `"${empNum}": self-referential manager assignment — skipped` });
        continue;
      }

      managerUpdates.push({ empId: emp.id, managerId });
    }

    if (managerUpdates.length) {
      const placeholders = managerUpdates.map(() => '(?::int, ?::int)').join(', ');
      await sequelize.query(
        `UPDATE employees AS e
         SET manager_id = v.manager_id, updated_at = NOW()
         FROM (VALUES ${placeholders}) AS v(id, manager_id)
         WHERE e.id = v.id`,
        { replacements: managerUpdates.flatMap((u) => [u.empId, u.managerId]), type: QueryTypes.UPDATE, transaction: t }
      );
    }

    // ── Pass 5: Bulk soft delete ──────────────────────────────────────────────
    logger.info('Import pass 5: Soft deleting missing employees', { ...context, step: 'pass5_soft_delete' });
    const toSoftDeleteIds = [];

    for (const [empNum, emp] of empByNum.entries()) {
      if (!emp.is_active)               continue;
      if (fileEmpNums.has(empNum))      continue;
      if (adminEmployeeIds.has(emp.id)) continue;
      toSoftDeleteIds.push(emp.id);
      softDeletedEmps.push(empNum);
    }

    if (toSoftDeleteIds.length) {
      const placeholders = toSoftDeleteIds.map(() => '?').join(', ');
      await sequelize.query(
        `UPDATE employees SET is_active = false, updated_at = NOW() WHERE id IN (${placeholders})`,
        { replacements: toSoftDeleteIds, type: QueryTypes.UPDATE, transaction: t }
      );
      softDeleted = toSoftDeleteIds.length;
    }

    // ── Pass 6: Bulk role sync ────────────────────────────────────────────────
    logger.info('Import pass 6: Re-evaluating system roles', { ...context, step: 'pass6_role_sync' });

    const [managerRows, systemRoleRows] = await Promise.all([
      sequelize.query(
        `SELECT DISTINCT manager_id FROM employees WHERE manager_id IS NOT NULL AND is_active = true`,
        { type: QueryTypes.SELECT, transaction: t }
      ),
      EmployeeRole.findAll({
        where:       { role_id: [systemRoleIds.employee, systemRoleIds.manager] },
        attributes:  ['employee_id', 'role_id'],
        transaction: t,
      }),
    ]);

    const currentManagerIds = new Set(managerRows.map((r) => r.manager_id));
    const toPromoteIds      = [];
    const toDemoteIds       = [];

    for (const er of systemRoleRows) {
      if (adminEmployeeIds.has(er.employee_id)) continue;
      const shouldBeManager = currentManagerIds.has(er.employee_id);
      const empNumber = empNumById.get(er.employee_id) ?? newlyInsertedById.get(er.employee_id);

      if (shouldBeManager && er.role_id !== systemRoleIds.manager) {
        toPromoteIds.push(er.employee_id);
        if (empNumber) promotedToManager.push(empNumber);
      } else if (!shouldBeManager && er.role_id !== systemRoleIds.employee) {
        toDemoteIds.push(er.employee_id);
        if (empNumber) demotedToEmployee.push(empNumber);
      }
    }

    if (toPromoteIds.length) {
      await sequelize.query(
        `UPDATE employee_roles SET role_id = :newRoleId
         WHERE employee_id IN (:ids) AND role_id = :oldRoleId`,
        { replacements: { newRoleId: systemRoleIds.manager, ids: toPromoteIds, oldRoleId: systemRoleIds.employee }, type: QueryTypes.UPDATE, transaction: t }
      );
    }

    if (toDemoteIds.length) {
      await sequelize.query(
        `UPDATE employee_roles SET role_id = :newRoleId
         WHERE employee_id IN (:ids) AND role_id = :oldRoleId`,
        { replacements: { newRoleId: systemRoleIds.employee, ids: toDemoteIds, oldRoleId: systemRoleIds.manager }, type: QueryTypes.UPDATE, transaction: t }
      );
    }

    logger.info('Import passes completed', { ...context, step: 'transaction_summary', inserted, updated, softDeleted });

    return { inserted, updated, softDeleted, softDeletedEmps, promotedToManager, demotedToEmployee, managerWarnings };
  });

  logger.info('Import transaction committed', { ...context, inserted: summary.inserted, updated: summary.updated });
  return summary;
}

module.exports = { processRows, fetchExistingEmailMap };