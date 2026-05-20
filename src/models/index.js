'use strict';

const { sequelize } = require('../core/config/database');

const Department         = require('./Department');
const Employee           = require('./Employee');
const Course             = require('./Course');
const CourseAssignment   = require('./CourseAssignment');
const Certificate        = require('./Certificate');
const CareerPath         = require('./CareerPath');
const CareerPathStage    = require('./CareerPathStage');
const EmployeeCareerPath = require('./EmployeeCareerPath');
const Role               = require('./Role');
const Permission         = require('./Permission');
const RolePermission     = require('./RolePermission');
const EmployeeRole       = require('./EmployeeRole');
const ActivityLog        = require('./ActivityLog');
const ErrorLog           = require('./ErrorLog');
const SchedulerLog       = require('./SchedulerLog');
const RefreshToken       = require('./RefreshToken');
const ImportLog            = require('../modules/import/importLog.model');
const IdealRole            = require('./IdealRole');
const OrgRole              = require('./OrgRole');
const PrimaryTechStack     = require('./PrimaryTechStack');
const CareerPathStepCourse = require('./CareerPathStepCourse');

// ── Employee ↔ Role (M2M via employee_roles) ─────────────────────────────────
Employee.belongsToMany(Role, {
  through:    EmployeeRole,
  foreignKey: 'employee_id',
  otherKey:   'role_id',
  as:         'roles',
});
Role.belongsToMany(Employee, {
  through:    EmployeeRole,
  foreignKey: 'role_id',
  otherKey:   'employee_id',
  as:         'employees',
});

// ── Role ↔ Permission (M2M via role_permissions) ─────────────────────────────
Role.belongsToMany(Permission, {
  through:    RolePermission,
  foreignKey: 'role_id',
  otherKey:   'permission_id',
  as:         'permissions',
});
Permission.belongsToMany(Role, {
  through:    RolePermission,
  foreignKey: 'permission_id',
  otherKey:   'role_id',
  as:         'roles',
});
Employee.belongsTo(Employee, {
  as: 'manager',
  foreignKey: 'manager_id'
});

Employee.hasMany(Employee, {
  as: 'team',
  foreignKey: 'manager_id'
});

// ── Department ↔ Employee (1:N) ───────────────────────────────────────────────
Department.hasMany(Employee, { foreignKey: 'department_id', as: 'employees' });
Employee.belongsTo(Department, { foreignKey: 'department_id', as: 'department' });

// ── Employee self-reference (manager hierarchy) ───────────────────────────────
// Employee.hasMany(Employee, { foreignKey: 'manager_id', as: 'directReports' });
// Employee.belongsTo(Employee, { foreignKey: 'manager_id', as: 'manager' });

// ── Course ↔ CourseAssignment (1:N) ───────────────────────────────────────────
Course.hasMany(CourseAssignment, { foreignKey: 'course_id', as: 'assignments' });
CourseAssignment.belongsTo(Course, { foreignKey: 'course_id', as: 'course' });

// ── Employee ↔ CourseAssignment — assigned to ─────────────────────────────────
Employee.hasMany(CourseAssignment, { foreignKey: 'employee_id', as: 'assignments' });
CourseAssignment.belongsTo(Employee, { foreignKey: 'employee_id', as: 'employee' });

// ── Employee ↔ CourseAssignment — assigned by ─────────────────────────────────
Employee.hasMany(CourseAssignment, { foreignKey: 'assigned_by', as: 'assignedCourses' });
CourseAssignment.belongsTo(Employee, { foreignKey: 'assigned_by', as: 'assignedBy' });

// ── Employee ↔ Certificate (1:N) ──────────────────────────────────────────────
Employee.hasMany(Certificate, { foreignKey: 'employee_id', as: 'certificates' });
Certificate.belongsTo(Employee, { foreignKey: 'employee_id', as: 'employee' });

// ── IdealRole ↔ CareerPath (1:N) ──────────────────────────────────────────────
IdealRole.hasMany(CareerPath, { foreignKey: 'ideal_role_id', as: 'careerPathSteps' });
CareerPath.belongsTo(IdealRole, { foreignKey: 'ideal_role_id', as: 'idealRole' });

// ── CareerPath ↔ Course (M:M via career_path_step_courses) ───────────────────
CareerPath.belongsToMany(Course, {
  through:    CareerPathStepCourse,
  foreignKey: 'career_path_id',
  otherKey:   'course_id',
  as:         'requiredCourses',
});
Course.belongsToMany(CareerPath, {
  through:    CareerPathStepCourse,
  foreignKey: 'course_id',
  otherKey:   'career_path_id',
  as:         'careerPathSteps',
});

// ── Employee → current CareerPath step ───────────────────────────────────────
Employee.belongsTo(CareerPath, { foreignKey: 'current_career_path_id', as: 'currentCareerStep' });
CareerPath.hasMany(Employee,   { foreignKey: 'current_career_path_id', as: 'employeesAtStep' });


// ── Employee ↔ ActivityLog (1:N) ──────────────────────────────────────────────
Employee.hasMany(ActivityLog, { foreignKey: 'employee_id', as: 'activityLogs' });
ActivityLog.belongsTo(Employee, { foreignKey: 'employee_id', as: 'employee' });

// ── Employee → Course (who created it) ────────────────────────────────────────
Employee.hasMany(Course, { foreignKey: 'created_by', as: 'createdCourses' });
Course.belongsTo(Employee, { foreignKey: 'created_by', as: 'creator' });

// ── Employee ↔ RefreshToken (1:N) ─────────────────────────────────────────────
Employee.hasMany(RefreshToken, { foreignKey: 'employee_id', as: 'refreshTokens' });
RefreshToken.belongsTo(Employee, { foreignKey: 'employee_id', as: 'employee' });

// ImportLog ↔ Employee (who uploaded)
ImportLog.belongsTo(Employee, { foreignKey: 'uploaded_by', as: 'uploader'   });
Employee.hasMany(ImportLog,   { foreignKey: 'uploaded_by', as: 'importLogs' });

// ── Employee ↔ IdealRole (N:1) ────────────────────────────────────────────────
Employee.belongsTo(IdealRole, { foreignKey: 'ideal_role_id', as: 'idealRole' });
IdealRole.hasMany(Employee,   { foreignKey: 'ideal_role_id', as: 'employees' });

// ── Employee ↔ OrgRole (N:1) ──────────────────────────────────────────────────
Employee.belongsTo(OrgRole, { foreignKey: 'org_role_id', as: 'orgRole' });
OrgRole.hasMany(Employee,   { foreignKey: 'org_role_id', as: 'employees' });

// ── Employee ↔ PrimaryTechStack (N:1) ─────────────────────────────────────────
Employee.belongsTo(PrimaryTechStack, { foreignKey: 'primary_tech_stack_id', as: 'primaryTechStack' });
PrimaryTechStack.hasMany(Employee,   { foreignKey: 'primary_tech_stack_id', as: 'employees' });

// ── IdealRole ↔ Department (N:1) ──────────────────────────────────────────────
IdealRole.belongsTo(Department, { foreignKey: 'department_id', as: 'department' });
Department.hasMany(IdealRole,   { foreignKey: 'department_id', as: 'idealRoles' });
 


module.exports = {
  sequelize,
  Department,
  Employee,
  Course,
  CourseAssignment,
  Certificate,
  CareerPath,
  CareerPathStage,
  EmployeeCareerPath,
  Role,
  Permission,
  RolePermission,
  EmployeeRole,
  ActivityLog,
  ErrorLog,
  SchedulerLog,
  RefreshToken,
  ImportLog,
  IdealRole,
  OrgRole,
  PrimaryTechStack,
  CareerPathStepCourse,
};