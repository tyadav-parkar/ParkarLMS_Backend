'use strict';

const express = require('express');
const router = express.Router();
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
const { authMiddleware } = require('../middlewares/authMiddleware');
const { requirePermission, requireAnyPermission } = require('../middlewares/roleMiddleware');
const { 
  validateCreateRole, 
  validateUpdateRole, 
  validateDeleteRole,
  validateAssignRole,
  validateGetRoles,
  validateGetUsers,
} = require('../middlewares/validationMiddleware');

// ── MUST come before /:id — otherwise Express matches "permissions"/"users"/"assign" as an id ──

// GET routes: accessible with EITHER the view OR edit permission (OR logic)
// With query validation
router.get('/permissions', authMiddleware, requireAnyPermission('role_view', 'role_edit'), getPermissions);
router.get('/users', authMiddleware, requireAnyPermission('user_view', 'user_edit'), validateGetUsers, getUsers);
router.post('/assign', authMiddleware, requirePermission('user_edit'), validateAssignRole, assignRole);

// ── Roles CRUD ────────────────────────────────────────────────────────────────
// Read routes: role_view OR role_edit (with query validation)
router.get('/', authMiddleware, requireAnyPermission('role_view', 'role_edit'), validateGetRoles, getRoles);
router.get('/:id', authMiddleware, requireAnyPermission('role_view', 'role_edit'), getRole);

// Mutating routes: role_edit only (with body validation)
router.post('/', authMiddleware, requirePermission('role_edit'), validateCreateRole, createRole);
router.put('/:id', authMiddleware, requirePermission('role_edit'), validateUpdateRole, updateRole);
router.delete('/:id', authMiddleware, requirePermission('role_edit'), validateDeleteRole, deleteRole);

module.exports = router;

