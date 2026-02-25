'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    const now = new Date();

    await queryInterface.bulkInsert('roles', [
      {
        name: 'admin',
        description: 'Full access to all features',
        permissions: JSON.stringify({
          view_dashboard: true,
          view_own_courses: true,
          mark_course_complete: true,
          view_own_certificates: true,
          view_own_career_path: true,
          view_team: true,
          assign_courses_team: true,
          view_team_certificates: true,
          view_team_analytics: true,
          manage_courses: true,
          manage_employees: true,
          trigger_sync: true,
          view_org_analytics: true,
          manage_roles: true,
          view_logs: true,
          configure_scheduler: true,
          export_reports: true,
        }),
        is_system_role: true,
        created_at: now,
        updated_at: now,
      },
      {
        name: 'manager',
        description: 'Team management and course assignment',
        permissions: JSON.stringify({
          view_dashboard: true,
          view_own_courses: true,
          mark_course_complete: true,
          view_own_certificates: true,
          view_own_career_path: true,
          view_team: true,
          assign_courses_team: true,
          view_team_certificates: true,
          view_team_analytics: true,
          manage_courses: false,
          manage_employees: false,
          trigger_sync: false,
          view_org_analytics: false,
          manage_roles: false,
          view_logs: false,
          configure_scheduler: false,
          export_reports: true,
        }),
        is_system_role: true,
        created_at: now,
        updated_at: now,
      },
      {
        name: 'employee',
        description: 'Self-access only — view own data',
        permissions: JSON.stringify({
          view_dashboard: true,
          view_own_courses: true,
          mark_course_complete: true,
          view_own_certificates: true,
          view_own_career_path: true,
          view_team: false,
          assign_courses_team: false,
          view_team_certificates: false,
          view_team_analytics: false,
          manage_courses: false,
          manage_employees: false,
          trigger_sync: false,
          view_org_analytics: false,
          manage_roles: false,
          view_logs: false,
          configure_scheduler: false,
          export_reports: false,
        }),
        is_system_role: true,
        created_at: now,
        updated_at: now,
      },
    ]);
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.bulkDelete('roles', {
      name: ['admin', 'manager', 'employee'],
    });
  },
};
