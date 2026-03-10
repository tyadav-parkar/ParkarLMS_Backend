'use strict';

const express = require('express');
const router = express.Router();
const {
  getRoles,
  getPermissions,
  getRole,
  createRole,
  updateRole,
  deleteRole,
} = require('../controllers/roleController');
const { authMiddleware } = require('../middlewares/authMiddleware');
const { requirePermission, requireAnyPermission } = require('../middlewares/roleMiddleware');
const {
  validateCreateRole,
  validateUpdateRole,
  validateDeleteRole,
  validateGetRoles,
} = require('../validations/roleValidations');

// ── MUST come before /:id — otherwise Express matches "permissions"/"users"/"assign" as an id ──

// GET routes: accessible with EITHER the view OR edit permission (OR logic)
router.get('/permissions', authMiddleware, requireAnyPermission('role_view', 'role_edit'), getPermissions);

// ── Roles CRUD ────────────────────────────────────────────────────────────────
// Read routes: role_view OR role_edit (with query validation)
router.get('/', authMiddleware, requireAnyPermission('role_view', 'role_edit'), validateGetRoles, getRoles);
router.get('/:id', authMiddleware, requireAnyPermission('role_view', 'role_edit'), getRole);

// Mutating routes: role_edit only (with body validation)
router.post('/', authMiddleware, requirePermission('role_edit'), validateCreateRole, createRole);
router.put('/:id', authMiddleware, requirePermission('role_edit'), validateUpdateRole, updateRole);
router.delete('/:id', authMiddleware, requirePermission('role_edit'), validateDeleteRole, deleteRole);

module.exports = router;