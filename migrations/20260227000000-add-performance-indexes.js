'use strict';

/** 
 * Migration: Add Performance Indexes
 * 
 * This migration adds indexes to improve query performance for frequently accessed data.
 * Run with: npx sequelize-cli db:migrate
 * 
 * Note: This migration is idempotent - it checks if indexes exist before creating them.
 * It won't fail if indexes already exist.
 */

module.exports = {
  up: async (queryInterface, Sequelize) => {
    // Helper function to check if index exists
    const indexExists = async (indexName) => {
      const result = await queryInterface.sequelize.query(
        `SELECT 1 FROM pg_indexes WHERE indexname = :indexName`,
        { replacements: { indexName }, type: Sequelize.QueryTypes.SELECT }
      );
      return result.length > 0;
    };

    // Helper to create index only if it doesn't exist
    const createIndexIfNotExists = async (tableName, columns, options = {}) => {
      const indexName = options.name || `${tableName}_${columns.join('_')}_idx`;
      const exists = await indexExists(indexName);
      
      if (!exists) {
        await queryInterface.addIndex(tableName, columns, options);
        console.log(`✅ Created index: ${indexName}`);
      } else {
        console.log(`⏭️  Skipped index (already exists): ${indexName}`);
      }
    };

    // ── Employees Table Indexes ─────────────────────────────────────────────────
    await createIndexIfNotExists('employees', ['email'], {
      unique: true,
      name: 'employees_email_idx'
    });
    
    await createIndexIfNotExists('employees', ['employee_number'], {
      unique: true,
      name: 'employees_employee_number_idx'
    });
    
    await createIndexIfNotExists('employees', ['department_id'], {
      name: 'employees_department_id_idx'
    });
    
    await createIndexIfNotExists('employees', ['manager_id'], {
      name: 'employees_manager_id_idx'
    });
    
    await createIndexIfNotExists('employees', ['is_active'], {
      name: 'employees_is_active_idx'
    });
    
    await createIndexIfNotExists('employees', ['last_login'], {
      name: 'employees_last_login_idx'
    });

    // ── Activity Logs Table Indexes ──────────────────────────────────────────────
    await createIndexIfNotExists('activity_logs', ['employee_id', 'created_at'], {
      name: 'activity_logs_employee_created_idx'
    });
    
    await createIndexIfNotExists('activity_logs', ['action_type'], {
      name: 'activity_logs_action_type_idx'
    });
    
    await createIndexIfNotExists('activity_logs', ['created_at'], {
      name: 'activity_logs_created_at_idx'
    });

    // ── Error Logs Table Indexes ─────────────────────────────────────────────────
    // Note: error_logs uses 'user_id' not 'employee_id'
    await createIndexIfNotExists('error_logs', ['user_id'], {
      name: 'error_logs_user_id_idx'
    });
    
    await createIndexIfNotExists('error_logs', ['created_at'], {
      name: 'error_logs_created_at_idx'
    });
    
    await createIndexIfNotExists('error_logs', ['severity'], {
      name: 'error_logs_severity_idx'
    });
    
    await createIndexIfNotExists('error_logs', ['is_resolved'], {
      name: 'error_logs_is_resolved_idx'
    });

    // ── Employee Roles Junction Table Indexes ────────────────────────────────────
    await createIndexIfNotExists('employee_roles', ['employee_id'], {
      name: 'employee_roles_employee_id_idx'
    });
    
    await createIndexIfNotExists('employee_roles', ['role_id'], {
      name: 'employee_roles_role_id_idx'
    });
    
    await createIndexIfNotExists('employee_roles', ['is_primary'], {
      name: 'employee_roles_is_primary_idx'
    });

    // ── Role Permissions Junction Table Indexes ─────────────────────────────────
    await createIndexIfNotExists('role_permissions', ['role_id'], {
      name: 'role_permissions_role_id_idx'
    });
    
    await createIndexIfNotExists('role_permissions', ['permission_id'], {
      name: 'role_permissions_permission_id_idx'
    });

    // ── Course Assignments Table Indexes ────────────────────────────────────────
    await createIndexIfNotExists('course_assignments', ['employee_id'], {
      name: 'course_assignments_employee_id_idx'
    });
    
    await createIndexIfNotExists('course_assignments', ['course_id'], {
      name: 'course_assignments_course_id_idx'
    });
    
    await createIndexIfNotExists('course_assignments', ['assigned_by'], {
      name: 'course_assignments_assigned_by_idx'
    });
    
    await createIndexIfNotExists('course_assignments', ['status'], {
      name: 'course_assignments_status_idx'
    });

    // ── Employee Career Paths Table Indexes ─────────────────────────────────────
    await createIndexIfNotExists('employee_career_paths', ['employee_id'], {
      unique: true,
      name: 'employee_career_paths_employee_id_idx'
    });
    
    await createIndexIfNotExists('employee_career_paths', ['career_path_id'], {
      name: 'employee_career_paths_career_path_id_idx'
    });

    console.log('✅ Performance indexes migration completed');
  },

  down: async (queryInterface, Sequelize) => {
    // Note: down method won't fail if indexes don't exist
    const indexes = [
      // Employees
      'employees_email_idx',
      'employees_employee_number_idx',
      'employees_department_id_idx',
      'employees_manager_id_idx',
      'employees_is_active_idx',
      'employees_last_login_idx',
      // Activity logs
      'activity_logs_employee_created_idx',
      'activity_logs_action_type_idx',
      'activity_logs_created_at_idx',
      // Error logs
      'error_logs_user_id_idx',
      'error_logs_created_at_idx',
      'error_logs_severity_idx',
      'error_logs_is_resolved_idx',
      // Employee roles
      'employee_roles_employee_id_idx',
      'employee_roles_role_id_idx',
      'employee_roles_is_primary_idx',
      // Role permissions
      'role_permissions_role_id_idx',
      'role_permissions_permission_id_idx',
      // Course assignments
      'course_assignments_employee_id_idx',
      'course_assignments_course_id_idx',
      'course_assignments_assigned_by_idx',
      'course_assignments_status_idx',
      // Employee career paths
      'employee_career_paths_employee_id_idx',
      'employee_career_paths_career_path_id_idx',
    ];

    for (const indexName of indexes) {
      try {
        // Try to find which table the index belongs to
        const result = await queryInterface.sequelize.query(
          `SELECT tablename FROM pg_indexes WHERE indexname = :indexName`,
          { replacements: { indexName }, type: Sequelize.QueryTypes.SELECT }
        );
        
        if (result.length > 0) {
          await queryInterface.removeIndex(result[0].tablename, indexName);
          console.log(`✅ Dropped index: ${indexName}`);
        }
      } catch (error) {
        console.log(`⏭️  Could not drop index ${indexName}: ${error.message}`);
      }
    }

    console.log('✅ Performance indexes removed');
  }
};

