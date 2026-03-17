'use strict';

/**
 * import.service.js
 * src/modules/import/import.service.js
 *
 * ┌────────────────────────────────────────────────────────────────────────────┐
 * │ Pass 1 — fetch system role ids (employee, manager, admin)                  │
 * │ Pass 2 — load ALL employees + departments into memory maps                 │
 * │ Pass 3 — upsert employees (dept lookup/auto-create; NO manager_id yet)     │
 * │ Pass 4 — manager_id resolution                                             │
 * │            Excel "PINT0097" (string) → empByNum.get() → integer id         │
 * │            UPDATE manager_id = 42  ← integer written to DB                 │
 * │            String NEVER reaches Postgres                                   │
 * │ Pass 5 — soft delete employees absent from this file                       │
 * │            GUARD: admins NEVER soft deleted                                │
 * │ Pass 6 — system role re-evaluation (employee ↔ manager)                   │
 * │            GUARD: admins NEVER touched                                     │
 * │            GUARD: custom roles (is_system_role=false) NEVER touched        │
 * └────────────────────────────────────────────────────────────────────────────┘
 */

const { QueryTypes }  = require('sequelize');
const { sequelize }   = require('../../core/config/database');
const Employee        = require('../../models/Employee');
const Department      = require('../../models/Department');
const Role            = require('../../models/Role');
const EmployeeRole    = require('../../models/EmployeeRole');

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

// ── Main export ───────────────────────────────────────────────────────────────

async function processRows(validRows) {
  const deptNameCache     = new Map();
  let   inserted          = 0;
  let   updated           = 0;
  let   softDeleted       = 0;
  const softDeletedEmps   = [];
  const promotedToManager = [];
  const demotedToEmployee = [];
  const managerWarnings   = [];

  await sequelize.transaction(async (t) => {

    // ── Pass 1: system role ids ───────────────────────────────────────────────
    const systemRoleIds = await getSystemRoleIds(t);

    // ── Pass 2: load all employees + departments into memory ──────────────────
    const existingEmployees = await Employee.scope('withInactive').findAll({
      attributes:  ['id', 'employee_number', 'email', 'is_active'],
      transaction: t,
    });

    const empByNum = new Map(
      existingEmployees.map((e) => [
        e.employee_number.toUpperCase(),
        { id: e.id, email: e.email.toLowerCase(), is_active: e.is_active },
      ])
    );
    const empByEmail = new Map(
      existingEmployees.map((e) => [e.email.toLowerCase(), { id: e.id }])
    );

    // Fetch admin employee ids using QueryTypes.SELECT so Postgres returns
    // plain rows without metadata — avoids column name casing issues
    const adminRows = await sequelize.query(
      `SELECT er.employee_id
       FROM   employee_roles er
       WHERE  er.role_id = :adminRoleId`,
      {
        replacements: { adminRoleId: systemRoleIds.admin },
        type:         QueryTypes.SELECT,
        transaction:  t,
      }
    );
    const adminEmployeeIds = new Set(adminRows.map((r) => r.employee_id));

    // Pre-load dept cache — use unscoped findAll to get all depts including inactive
    const existingDepts = await Department.unscoped().findAll({
      attributes:  ['id', 'name', 'code'],
      transaction: t,
    });
    const existingDeptCodes = new Set();
    existingDepts.forEach((d) => {
      if (d.code) existingDeptCodes.add(d.code.toUpperCase());
      deptNameCache.set(d.name.trim().toLowerCase(), d.id);
    });

    // Set of emp#s in this file — used in Pass 5
    const fileEmpNums = new Set(validRows.map((r) => r.employee_number.toUpperCase()));

    // ── Pass 3: upsert employees ──────────────────────────────────────────────
    for (const row of validRows) {
      const empNum = row.employee_number.toUpperCase();
      const email  = row.email.toLowerCase();

      let departmentId;
      if (row.department?.trim()) {
        departmentId = await getOrCreateDepartment(
          row.department, deptNameCache, existingDeptCodes, t
        );
      }

      const payload = {};
      if (row.first_name?.trim())      payload.first_name      = row.first_name.trim();
      if (row.last_name?.trim())       payload.last_name       = row.last_name.trim();
      if (row.email?.trim())           payload.email           = email;
      if (row.job_title?.trim())       payload.job_title       = row.job_title.trim().substring(0, 150);
      if (row.band_identifier?.trim()) payload.band_identifier = row.band_identifier.trim().substring(0, 50);
      if (departmentId !== undefined)  payload.department_id   = departmentId;

      const existing = empByNum.get(empNum);

      if (existing) {
        if (!existing.is_active) payload.is_active = true;
        await Employee.scope('withInactive').update(payload, {
          where: { id: existing.id }, transaction: t,
        });
        updated++;
      } else {
        const newEmployee = await Employee.create(
          { employee_number: empNum, is_active: true, password_hash: null, ...payload },
          { transaction: t }
        );
        await EmployeeRole.create(
          { employee_id: newEmployee.id, role_id: systemRoleIds.employee, is_primary: true },
          { transaction: t }
        );
        empByNum.set(empNum,  { id: newEmployee.id, email, is_active: true });
        empByEmail.set(email, { id: newEmployee.id });
        inserted++;
      }
    }

    // ── Pass 4: manager_id resolution (string emp# → integer FK) ─────────────
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
          managerWarnings.push({
            field:   'Manager Emp Number',
            message: `"${empNum}": manager "${row.manager_emp_number}" not found — manager_id left unchanged`,
          });
        }
      } else if (row.reports_to_email?.trim()) {
        const mgr = empByEmail.get(row.reports_to_email.toLowerCase());
        if (mgr) {
          managerId = mgr.id;
        } else {
          managerWarnings.push({
            field:   'Reports To Email',
            message: `"${empNum}": manager email "${row.reports_to_email}" not found — manager_id left unchanged`,
          });
        }
      }

      if (managerId === null) continue;

      if (managerId === emp.id) {
        managerWarnings.push({
          field:   'Manager Emp Number',
          message: `"${empNum}": self-referential manager assignment — skipped`,
        });
        continue;
      }

      await Employee.scope('withInactive').update(
        { manager_id: managerId },
        { where: { id: emp.id }, transaction: t }
      );
    }

    // ── Pass 5: soft delete employees absent from this file ───────────────────
    for (const [empNum, emp] of empByNum.entries()) {
      if (!emp.is_active)               continue;
      if (fileEmpNums.has(empNum))      continue;
      if (adminEmployeeIds.has(emp.id)) continue; // ADMIN GUARD

      await Employee.scope('withInactive').update(
        { is_active: false },
        { where: { id: emp.id }, transaction: t }
      );
      softDeleted++;
      softDeletedEmps.push(empNum);
    }

    // ── Pass 6: system role re-evaluation (employee ↔ manager) ───────────────
    // employee_roles uses a composite PK (employee_id, role_id) — no id column.
    // Updates use WHERE employee_id + role_id, never WHERE id.
    const managerRows = await sequelize.query(
      `SELECT DISTINCT manager_id
       FROM   employees
       WHERE  manager_id IS NOT NULL
       AND    is_active = true`,
      { type: QueryTypes.SELECT, transaction: t }
    );
    const currentManagerIds = new Set(managerRows.map((r) => r.manager_id));

    // Fetch only employee + manager system role rows — admin excluded by WHERE
    const systemRoleRows = await EmployeeRole.findAll({
      where:       { role_id: [systemRoleIds.employee, systemRoleIds.manager] },
      attributes:  ['employee_id', 'role_id'],   // no id — composite PK table
      transaction: t,
    });

    for (const er of systemRoleRows) {
      if (adminEmployeeIds.has(er.employee_id)) continue; // admin guard

      const shouldBeManager = currentManagerIds.has(er.employee_id);

      if (shouldBeManager && er.role_id !== systemRoleIds.manager) {
        // Promote: employee → manager
        // Raw query used because EmployeeRole has composite PK (no id column)
        // and Sequelize's model.update() is unreliable on composite PK tables
        await sequelize.query(
          `UPDATE employee_roles
           SET    role_id = :newRoleId
           WHERE  employee_id = :empId
           AND    role_id     = :oldRoleId`,
          {
            replacements: {
              newRoleId: systemRoleIds.manager,
              empId:     er.employee_id,
              oldRoleId: systemRoleIds.employee,
            },
            type:        QueryTypes.UPDATE,
            transaction: t,
          }
        );
        const emp = existingEmployees.find((e) => e.id === er.employee_id);
        if (emp) promotedToManager.push(emp.employee_number);

      } else if (!shouldBeManager && er.role_id !== systemRoleIds.employee) {
        // Demote: manager → employee
        await sequelize.query(
          `UPDATE employee_roles
           SET    role_id = :newRoleId
           WHERE  employee_id = :empId
           AND    role_id     = :oldRoleId`,
          {
            replacements: {
              newRoleId: systemRoleIds.employee,
              empId:     er.employee_id,
              oldRoleId: systemRoleIds.manager,
            },
            type:        QueryTypes.UPDATE,
            transaction: t,
          }
        );
        const emp = existingEmployees.find((e) => e.id === er.employee_id);
        if (emp) demotedToEmployee.push(emp.employee_number);
      }
    }

  }); // ← transaction commits here

  return {
    inserted,
    updated,
    softDeleted,
    softDeletedEmps,
    promotedToManager,
    demotedToEmployee,
    managerWarnings,
  };
}

module.exports = { processRows };