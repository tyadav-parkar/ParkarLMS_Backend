'use strict';

const { sequelize } = require('../config/database');

const Department = require('./Department');
const Employee = require('./Employee');
const Course = require('./Course');
const CourseAssignment = require('./CourseAssignment');
const Certificate = require('./Certificate');
const CareerPath = require('./CareerPath');
const CareerPathStage = require('./CareerPathStage');
const EmployeeCareerPath = require('./EmployeeCareerPath');
const Role = require('./Role');
const ActivityLog = require('./ActivityLog');
const ErrorLog = require('./ErrorLog');
const SchedulerLog = require('./SchedulerLog');

// ── Department ↔ Employee (1:N) ──────────────────────────────────────────────
Department.hasMany(Employee, { foreignKey: 'department_id', as: 'employees' });
Employee.belongsTo(Department, { foreignKey: 'department_id', as: 'department' });

// ── Employee self-reference (manager hierarchy) ───────────────────────────────
Employee.hasMany(Employee, { foreignKey: 'manager_id', as: 'directReports' });
Employee.belongsTo(Employee, { foreignKey: 'manager_id', as: 'manager' });

// ── Course ↔ CourseAssignment (1:N) ──────────────────────────────────────────
Course.hasMany(CourseAssignment, { foreignKey: 'course_id', as: 'assignments' });
CourseAssignment.belongsTo(Course, { foreignKey: 'course_id', as: 'course' });

// ── Employee ↔ CourseAssignment (1:N) — assigned to ──────────────────────────
Employee.hasMany(CourseAssignment, { foreignKey: 'employee_id', as: 'assignments' });
CourseAssignment.belongsTo(Employee, { foreignKey: 'employee_id', as: 'employee' });

// ── Employee ↔ CourseAssignment (1:N) — assigned by ──────────────────────────
Employee.hasMany(CourseAssignment, { foreignKey: 'assigned_by', as: 'assignedCourses' });
CourseAssignment.belongsTo(Employee, { foreignKey: 'assigned_by', as: 'assignedBy' });

// ── Employee ↔ Certificate (1:N) ─────────────────────────────────────────────
Employee.hasMany(Certificate, { foreignKey: 'employee_id', as: 'certificates' });
Certificate.belongsTo(Employee, { foreignKey: 'employee_id', as: 'employee' });

// ── Department ↔ CareerPath (1:N) ────────────────────────────────────────────
Department.hasMany(CareerPath, { foreignKey: 'department_id', as: 'careerPaths' });
CareerPath.belongsTo(Department, { foreignKey: 'department_id', as: 'department' });

// ── CareerPath ↔ CareerPathStage (1:N) ───────────────────────────────────────
CareerPath.hasMany(CareerPathStage, { foreignKey: 'career_path_id', as: 'stages' });
CareerPathStage.belongsTo(CareerPath, { foreignKey: 'career_path_id', as: 'careerPath' });

// ── Employee ↔ EmployeeCareerPath (1:1) ──────────────────────────────────────
Employee.hasOne(EmployeeCareerPath, { foreignKey: 'employee_id', as: 'careerPathInfo' });
EmployeeCareerPath.belongsTo(Employee, { foreignKey: 'employee_id', as: 'employee' });
EmployeeCareerPath.belongsTo(CareerPath, { foreignKey: 'career_path_id', as: 'careerPath' });
EmployeeCareerPath.belongsTo(CareerPathStage, { foreignKey: 'current_stage_id', as: 'currentStage' });

// ── Employee ↔ ActivityLog (1:N) ─────────────────────────────────────────────
Employee.hasMany(ActivityLog, { foreignKey: 'employee_id', as: 'activityLogs' });
ActivityLog.belongsTo(Employee, { foreignKey: 'employee_id', as: 'employee' });

// ── Employee → Course (who created it) ───────────────────────────────────────
Employee.hasMany(Course, { foreignKey: 'created_by', as: 'createdCourses' });
Course.belongsTo(Employee, { foreignKey: 'created_by', as: 'creator' });

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
  ActivityLog,
  ErrorLog,
  SchedulerLog,
};
