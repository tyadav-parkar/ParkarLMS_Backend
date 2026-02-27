'use strict';

const express = require('express');
const router  = express.Router();
const {
  getRoles,
  getPermissions,
  getUsers,
  getRole,
  createRole,
  updateRole,
  deleteRole,
  assignRole,
} = require('../controllers/roleController');
const {authMiddleware }= require('../middlewares/authMiddleware');
const { requirePermission, requireAnyPermission } = require('../middlewares/roleMiddleware');

// ── MUST come before /:id — otherwise Express matches "permissions"/"users"/"assign" as an id ──
// GET routes: accessible with EITHER the view OR edit permission (OR logic)
router.get ('/permissions', authMiddleware, requireAnyPermission('role_view', 'role_edit'), getPermissions);
router.get ('/users',       authMiddleware, requireAnyPermission('user_view', 'user_edit'),  getUsers);
router.post('/assign',      authMiddleware, requirePermission('user_edit'),                  assignRole);

// ── Roles CRUD ────────────────────────────────────────────────────────────────
// Read routes: role_view OR role_edit
router.get   ('/',    authMiddleware, requireAnyPermission('role_view', 'role_edit'), getRoles);
router.get   ('/:id', authMiddleware, requireAnyPermission('role_view', 'role_edit'), getRole);
// Mutating routes: role_edit only
router.post  ('/',    authMiddleware, requirePermission('role_edit'), createRole);
router.put   ('/:id', authMiddleware, requirePermission('role_edit'), updateRole);
router.delete('/:id', authMiddleware, requirePermission('role_edit'), deleteRole);

module.exports = router;
