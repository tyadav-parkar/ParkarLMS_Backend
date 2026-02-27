'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface) {
    const now = new Date();

    // ── 7 granular grouped permissions ────────────────────────────────────────
    // Group 1 — User Management
    // Group 2 — Roles & Permissions
    // Group 3 — Course Management
    await queryInterface.bulkInsert('permissions', [
      {
        key:         'user_view',
        label:       'View Users',
        description: 'Access the User Management page in read-only mode',
        created_at:  now,
        updated_at:  now,
      },
      {
        key:         'user_edit',
        label:       'Edit Users',
        description: 'Assign and change roles for employees',
        created_at:  now,
        updated_at:  now,
      },
      {
        key:         'role_view',
        label:       'View Roles',
        description: 'Access the Roles & Permissions page in read-only mode',
        created_at:  now,
        updated_at:  now,
      },
      {
        key:         'role_edit',
        label:       'Manage Roles',
        description: 'Create, edit, delete roles and configure permissions per role',
        created_at:  now,
        updated_at:  now,
      },
      {
        key:         'course_view',
        label:       'View Courses',
        description: 'Browse the course catalogue',
        created_at:  now,
        updated_at:  now,
      },
      {
        key:         'course_edit',
        label:       'Manage Courses',
        description: 'Create, edit, archive courses in the catalogue',
        created_at:  now,
        updated_at:  now,
      },
      {
        key:         'course_assign',
        label:       'Assign Courses',
        description: 'Assign courses to individual employees or teams',
        created_at:  now,
        updated_at:  now,
      },
    ], { ignoreDuplicates: true });

    // ── 2. Fetch role IDs + permission IDs dynamically ─────────────────────────
    const [roles] = await queryInterface.sequelize.query(
      `SELECT id, name FROM roles WHERE name IN ('admin', 'manager', 'employee')`
    );
    const [perms] = await queryInterface.sequelize.query(
      `SELECT id, key FROM permissions`
    );

    const roleMap = {};
    roles.forEach((r) => { roleMap[r.name] = r.id; });

    const permMap = {};
    perms.forEach((p) => { permMap[p.key] = p.id; });

    // ── 3. Default role → permission assignments ───────────────────────────────
    const ROLE_PERMISSIONS = {
      admin: [
        'user_view',
        'user_edit',
        'role_view',
        'role_edit',
        'course_view',
        'course_edit',
        'course_assign',
      ],
      manager: [
        'course_view',
        'course_assign',
      ],
      employee: [],
    };

    const rows = [];
    for (const [roleName, permKeys] of Object.entries(ROLE_PERMISSIONS)) {
      for (const key of permKeys) {
        rows.push({
          role_id:       roleMap[roleName],
          permission_id: permMap[key],
          created_at:    now,
        });
      }
    }

    if (rows.length > 0) {
      await queryInterface.bulkInsert('role_permissions', rows, { ignoreDuplicates: true });
    }

    console.log('✅ Permissions seeded and assigned to system roles.');
  },

  async down(queryInterface) {
    await queryInterface.bulkDelete('role_permissions', null, {});
    await queryInterface.bulkDelete('permissions', null, {});
  },
};
